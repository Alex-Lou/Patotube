use dashmap::DashMap;
use std::sync::Arc;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::Mutex;

#[derive(Default, Clone)]
pub struct JobRegistry {
    inner: Arc<DashMap<String, Arc<Mutex<Option<CommandChild>>>>>,
}

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
