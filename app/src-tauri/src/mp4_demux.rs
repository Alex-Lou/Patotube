// Strip the video track out of a combined YouTube MP4, leaving a real
// audio-only .m4a. Used on Android when the audio-only CDN URL 403s and
// we have to fall back to grabbing the muxed `formats` entry: that file
// plays as audio in music apps but VLC etc. still see the video stream.
// This pass remuxes the original AAC samples into a fresh container
// containing only the AAC track — no transcoding, no ffmpeg.

#![cfg(target_os = "android")]

use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

use mp4::{
    AacConfig, MediaConfig, MediaType, Mp4Config, Mp4Reader, Mp4Writer, TrackConfig,
};

/// Reads `src` (any MP4 with an AAC audio track), writes a new MP4 to
/// `dst` containing only the AAC track. Returns Err if the source has
/// no AAC track (e.g. the audio is Opus in a webm) — caller should keep
/// the original file in that case.
pub fn extract_audio_to_m4a(src: &Path, dst: &Path) -> Result<(), String> {
    let src_file = File::open(src)
        .map_err(|e| format!("could not open source mp4: {e}"))?;
    let size = src_file
        .metadata()
        .map_err(|e| format!("could not stat source mp4: {e}"))?
        .len();
    let reader = BufReader::new(src_file);

    let mut mp4_reader = Mp4Reader::read_header(reader, size)
        .map_err(|e| format!("could not parse source mp4: {e}"))?;

    // Locate the AAC track (we only support AAC-in-MP4 — that's what
    // every YouTube combined `formats` entry serves on Android).
    let mut audio_track_id: Option<u32> = None;
    for (track_id, track) in mp4_reader.tracks() {
        if matches!(track.media_type(), Ok(MediaType::AAC)) {
            audio_track_id = Some(*track_id);
            break;
        }
    }
    let src_track_id = audio_track_id
        .ok_or_else(|| "source mp4 has no AAC audio track".to_string())?;

    // Build the new track's config from the existing AAC track. We
    // can't borrow the track across the writer creation because we need
    // `mp4_reader` mutably for sample reads, so capture everything we
    // need up front.
    let (track_conf, sample_count) = {
        let track = mp4_reader
            .tracks()
            .get(&src_track_id)
            .ok_or_else(|| "audio track vanished mid-read".to_string())?;

        let media_conf = MediaConfig::AacConfig(AacConfig {
            bitrate: track.bitrate(),
            profile: track
                .audio_profile()
                .map_err(|e| format!("audio_profile: {e}"))?,
            freq_index: track
                .sample_freq_index()
                .map_err(|e| format!("sample_freq_index: {e}"))?,
            chan_conf: track
                .channel_config()
                .map_err(|e| format!("channel_config: {e}"))?,
        });
        let conf = TrackConfig {
            track_type: track
                .track_type()
                .map_err(|e| format!("track_type: {e}"))?,
            timescale: track.timescale(),
            language: track.language().to_string(),
            media_conf,
        };
        let sc = mp4_reader
            .sample_count(src_track_id)
            .map_err(|e| format!("sample_count: {e}"))?;
        (conf, sc)
    };

    // Compose the output container. Re-using the source's brands keeps
    // every player happy; `iso5`/`mp42` etc. are all valid for an
    // audio-only file.
    let major_brand = *mp4_reader.major_brand();
    let minor_version = mp4_reader.minor_version();
    let compatible_brands = mp4_reader.compatible_brands().to_vec();
    let timescale = mp4_reader.timescale();

    let dst_file = File::create(dst)
        .map_err(|e| format!("could not create dst m4a: {e}"))?;
    let writer = BufWriter::new(dst_file);

    let mut mp4_writer = Mp4Writer::write_start(
        writer,
        &Mp4Config {
            major_brand,
            minor_version,
            compatible_brands,
            timescale,
        },
    )
    .map_err(|e| format!("mp4 writer init failed: {e}"))?;

    // First (and only) added track gets id 1 in the output.
    mp4_writer
        .add_track(&track_conf)
        .map_err(|e| format!("add_track: {e}"))?;
    let dst_track_id: u32 = 1;

    for sample_idx in 0..sample_count {
        let sample_id = sample_idx + 1;
        let sample = mp4_reader
            .read_sample(src_track_id, sample_id)
            .map_err(|e| format!("read_sample {sample_id}: {e}"))?
            .ok_or_else(|| format!("sample {sample_id} missing"))?;
        mp4_writer
            .write_sample(dst_track_id, &sample)
            .map_err(|e| format!("write_sample {sample_id}: {e}"))?;
    }

    mp4_writer
        .write_end()
        .map_err(|e| format!("mp4 writer finalise: {e}"))?;
    Ok(())
}
