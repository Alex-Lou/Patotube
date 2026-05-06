// Prevent additional console window on Windows in release; let dev keep it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    patotube_lib::run();
}
