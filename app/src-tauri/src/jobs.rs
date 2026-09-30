// Cancel handles per job_id: the yt-dlp child on desktop, or the tokio
// task of a native kernel (SoundCloud, Bandcamp, Archive, Audiomack,
// Android YouTube). `cancel` kills / aborts whichever is registered.

use dashmap::DashMap;
use std::sync::Arc;
#[cfg(not(target_os = "android"))]
use tauri_plugin_shell::process::CommandChild;
use tokio::task::AbortHandle;

enum JobHandle {
    #[cfg(not(target_os = "android"))]
    Child(CommandChild),
    Task(AbortHandle),
}

#[derive(Default, Clone)]
pub struct JobRegistry {
    inner: Arc<DashMap<String, JobHandle>>,
}

impl JobRegistry {
    #[cfg(not(target_os = "android"))]
    pub fn register(&self, job_id: String, child: CommandChild) {
        self.insert(job_id, JobHandle::Child(child));
    }

    pub fn register_task(&self, job_id: String, task: AbortHandle) {
        self.insert(job_id, JobHandle::Task(task));
    }

    /// A duplicate id must not orphan the previous job: stop it first.
    fn insert(&self, job_id: String, handle: JobHandle) {
        if let Some(previous) = self.inner.insert(job_id, handle) {
            stop(previous);
        }
    }

    pub fn remove(&self, job_id: &str) {
        self.inner.remove(job_id);
    }

    pub async fn cancel(&self, job_id: &str) {
        if let Some((_, handle)) = self.inner.remove(job_id) {
            stop(handle);
        }
    }

    #[cfg(test)]
    fn contains(&self, job_id: &str) -> bool {
        self.inner.contains_key(job_id)
    }
}

fn stop(handle: JobHandle) {
    match handle {
        #[cfg(not(target_os = "android"))]
        JobHandle::Child(child) => {
            let _ = child.kill();
        }
        JobHandle::Task(task) => task.abort(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn cancel_aborts_a_registered_task() {
        let registry = JobRegistry::default();
        let task = tokio::spawn(async { tokio::time::sleep(Duration::from_secs(60)).await });
        registry.register_task("job".into(), task.abort_handle());

        registry.cancel("job").await;

        assert!(task.await.unwrap_err().is_cancelled());
        assert!(!registry.contains("job"));
    }

    #[tokio::test]
    async fn duplicate_id_stops_the_previous_task() {
        let registry = JobRegistry::default();
        let first = tokio::spawn(async { tokio::time::sleep(Duration::from_secs(60)).await });
        let second = tokio::spawn(async { tokio::time::sleep(Duration::from_secs(60)).await });
        registry.register_task("job".into(), first.abort_handle());
        registry.register_task("job".into(), second.abort_handle());

        assert!(first.await.unwrap_err().is_cancelled());
        registry.cancel("job").await;
        assert!(second.await.unwrap_err().is_cancelled());
    }

    #[tokio::test]
    async fn cancel_and_remove_of_unknown_ids_are_no_ops() {
        let registry = JobRegistry::default();
        registry.cancel("nope").await;
        registry.remove("nope");
    }
}
