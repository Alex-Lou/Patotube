#![allow(dead_code)]

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub job_id: String,
    pub bytes_done: u64,
    pub bytes_total: Option<u64>,
    pub speed_bps: Option<f64>,
    pub eta_sec: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatusPayload {
    pub job_id: String,
    pub status: &'static str,
    pub error: Option<String>,
    pub file_path: Option<String>,
}

pub fn emit_progress(app: &AppHandle, payload: ProgressPayload) {
    let _ = app.emit("download://progress", payload);
}

pub fn emit_status(
    app: &AppHandle,
    job_id: &str,
    status: &'static str,
    error: Option<String>,
    file_path: Option<String>,
) {
    let _ = app.emit(
        "download://status",
        StatusPayload {
            job_id: job_id.to_string(),
            status,
            error,
            file_path,
        },
    );
}
