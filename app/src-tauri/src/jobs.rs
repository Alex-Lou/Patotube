// Tracks yt-dlp children per job_id for cancel(). No-op on Android (no subprocess).

use dashmap::DashMap;
use std::sync::Arc;
#[cfg(not(target_os = "android"))]
use tauri_plugin_shell::process::CommandChild;
#[cfg(not(target_os = "android"))]
use tokio::sync::Mutex;

#[cfg(not(target_os = "android"))]
#[derive(Default, Clone)]
pub struct JobRegistry {
    inner: Arc<DashMap<String, Arc<Mutex<Option<CommandChild>>>>>,
}

#[cfg(not(target_os = "android"))]
impl JobRegistry {
    pub fn register(&self, job_id: String, child: CommandChild) {
        self.inner.insert(job_id, Arc::new(Mutex::new(Some(child))));
    }

    pub fn remove(&self, job_id: &str) {
        self.inner.remove(job_id);
    }

    pub async fn cancel(&self, job_id: &str) {
        if let Some(entry) = self.inner.get(job_id).map(|e| e.value().clone()) {
            let mut guard = entry.lock().await;
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
        self.inner.remove(job_id);
    }
}

#[cfg(target_os = "android")]
#[derive(Default, Clone)]
pub struct JobRegistry;

#[cfg(target_os = "android")]
impl JobRegistry {
    pub fn remove(&self, _job_id: &str) {}
    pub async fn cancel(&self, _job_id: &str) {}
}
