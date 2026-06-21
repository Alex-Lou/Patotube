// Overlay copy of the Tauri-generated build.gradle.kts. Synced into
// gen/android/app/ by scripts/sync-android-overlay.mjs after each
// `tauri android init`. Currently identical to a vanilla Tauri
// generation — the overlay exists so future deps that don't come
// from a Tauri plugin (e.g. ExoPlayer if MediaPlayer ever fails on
// codecs) can be added here without being clobbered by `tauri
// android init`.

import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "io.patotube.app"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "io.patotube.app"
        minSdk = 24
        // targetSdk lowered to 29 on purpose: apps targeting <30 can keep
        // legacy external storage (with requestLegacyExternalStorage in
        // the manifest), so we can write to /sdcard/Download/Patotube/
        // and the user actually finds the file in any file manager.
        // We're not on Play Store anyway (sideload via GitHub Releases).
        targetSdk = 29
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            // R8/proguard disabled for now: hung indefinitely on the first
            // run. We trade ~5 MB of size for a working build until the
            // proguard rules are sorted. Sign with the auto-generated
            // debug keystore so the APK is installable for sideload.
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
    // Sideload distribution → we don't care about Play Store's
    // "targetSdk >= 33" requirement. Lint would otherwise reject the
    // release build because we lower targetSdk to 29 to keep legacy
    // external storage working on Android 13+.
    lint {
        disable += "ExpiredTargetSdkVersion"
        abortOnError = false
    }

    // One Patotube.apk on GitHub Releases that installs on every Android
    // CPU: Tauri builds per-ABI .so files; isUniversalApk packs all four
    // ABIs into a single fat archive so landing → download → install works
    // regardless of device architecture.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
            isUniversalApk = true
        }
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    // MediaSessionCompat + NotificationCompat.MediaStyle for the
    // play/pause/stop controls inside the foreground-service notification
    // shade. Tiny dep (~80 KB) vs ExoPlayer/media3, used only by
    // MediaPlaybackService.
    implementation("androidx.media:media:1.7.0")
    // Audio post-processing uses Android's built-in MediaExtractor +
    // MediaMuxer (no external dep). See PatoMobileBridge.kt and
    // docs/youtube-kernel.md.
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
