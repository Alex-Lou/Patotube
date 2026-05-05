// Translations for the static landing. Kept inline so the page works
// without any extra fetch. Mirrors a subset of the desktop app's keys.

export const SUPPORTED = ['en', 'fr', 'es', 'ar', 'ja', 'zh', 'is'] as const;
export type LandingLocale = (typeof SUPPORTED)[number];

export const RTL = new Set<LandingLocale>(['ar']);

export const LOCALE_META: Record<
  LandingLocale,
  { native: string; flag: string; abbr: string }
> = {
  en: { native: 'English', flag: '🇬🇧', abbr: 'EN' },
  fr: { native: 'Français', flag: '🇫🇷', abbr: 'FR' },
  es: { native: 'Español', flag: '🇪🇸', abbr: 'ES' },
  ar: { native: 'العربية', flag: '🇸🇦', abbr: 'AR' },
  ja: { native: '日本語', flag: '🇯🇵', abbr: 'JA' },
  zh: { native: '中文', flag: '🇨🇳', abbr: 'ZH' },
  is: { native: 'Íslenska', flag: '🇮🇸', abbr: 'IS' },
};

type Dict = {
  navFeatures: string;
  navDownload: string;
  heroLine1: string;
  heroLine2: string;
  heroDesc: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  downloadsTitle: string;
  downloadsSubtitle: string;
  downloadsHint: string;
  windowsLabel: string;
  windowsSub: string;
  androidLabel: string;
  androidSub: string;
  macosLabel: string;
  macosSub: string;
  linuxLabel: string;
  linuxSub: string;
  hoverCta: string;
  featuresTitle: string;
  featureYtTitle: string;
  featureYtBody: string;
  featureFormatsTitle: string;
  featureFormatsBody: string;
  featureI18nTitle: string;
  featureI18nBody: string;
  featureNativeTitle: string;
  featureNativeBody: string;
  featureSoonTitle: string;
  featureSoonBody: string;
  featureOssTitle: string;
  featureOssBody: string;
  footerCopy: string;
  footerIssues: string;
  footerReleases: string;
  comingSoon: string;
};

export const DICT: Record<LandingLocale, Dict> = {
  en: {
    navFeatures: 'Features',
    navDownload: 'Download',
    heroLine1: 'Drop a URL,',
    heroLine2: 'get the file.',
    heroDesc:
      'Modern, lightweight media downloader for Windows and Android. YouTube, SoundCloud, and many other sites. MP4 video or MP3 audio. Dark by default. 7 languages.',
    heroCtaPrimary: 'Download free',
    heroCtaSecondary: 'View source',
    downloadsTitle: 'Pick your platform',
    downloadsSubtitle: 'Free. No account. No ads. No telemetry.',
    downloadsHint:
      'Windows builds are unsigned for now — SmartScreen may flag them. Click "More info → Run anyway". Android APK requires enabling installs from unknown sources for the file you downloaded.',
    windowsLabel: 'Windows',
    windowsSub: '.exe installer',
    androidLabel: 'Android',
    androidSub: '.apk sideload',
    macosLabel: 'macOS',
    macosSub: 'coming soon',
    linuxLabel: 'Linux',
    linuxSub: 'coming soon',
    hoverCta: 'Click to download →',
    featuresTitle: "What it does, what it doesn't.",
    featureYtTitle: 'YouTube and SoundCloud, today',
    featureYtBody:
      'Plus many other sites that yt-dlp speaks. Drop the URL, the app figures out the rest.',
    featureFormatsTitle: 'MP4 video or MP3 audio',
    featureFormatsBody:
      'Pick the kind, pick the quality, hit download. ffmpeg ships in the bundle, no extra install.',
    featureI18nTitle: 'Dark by default, 7 languages',
    featureI18nBody:
      'English, French, Spanish, Arabic (RTL), Japanese, Chinese, Icelandic. Toggle theme any time.',
    featureNativeTitle: 'Light, fast, native',
    featureNativeBody:
      'Built on Tauri. Tiny binary, real OS window, no Electron bloat, no telemetry.',
    featureSoonTitle: 'Spotify and Deezer soon',
    featureSoonBody:
      'Match-via-YouTube workflow under design. Templates already in the UI, behind a coming-soon flag.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'MIT licensed. Read the code, file an issue, send a pull request. Same rules for everyone.',
    footerCopy: 'Patotube contributors · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Coming soon',
  },

  fr: {
    navFeatures: 'Fonctionnalités',
    navDownload: 'Télécharger',
    heroLine1: 'Une URL,',
    heroLine2: 'un fichier.',
    heroDesc:
      "Téléchargeur média moderne et léger pour Windows et Android. YouTube, SoundCloud et plein d'autres sites. Vidéo MP4 ou audio MP3. Mode sombre par défaut. 7 langues.",
    heroCtaPrimary: 'Télécharger gratuitement',
    heroCtaSecondary: 'Voir le code',
    downloadsTitle: 'Choisis ta plateforme',
    downloadsSubtitle: 'Gratuit. Sans compte. Sans pub. Sans télémétrie.',
    downloadsHint:
      "Les builds Windows ne sont pas encore signés — SmartScreen peut les flagger. Clique sur \"Informations complémentaires → Exécuter quand même\". L'APK Android demande l'autorisation d'installer depuis des sources inconnues pour le fichier téléchargé.",
    windowsLabel: 'Windows',
    windowsSub: 'Installeur .exe',
    androidLabel: 'Android',
    androidSub: 'Sideload .apk',
    macosLabel: 'macOS',
    macosSub: 'bientôt',
    linuxLabel: 'Linux',
    linuxSub: 'bientôt',
    hoverCta: 'Cliquer pour télécharger →',
    featuresTitle: "Ce qu'elle fait, ce qu'elle ne fait pas.",
    featureYtTitle: "YouTube et SoundCloud, dès aujourd'hui",
    featureYtBody:
      "Plus plein d'autres sites supportés par yt-dlp. Colle l'URL, l'app gère le reste.",
    featureFormatsTitle: 'Vidéo MP4 ou audio MP3',
    featureFormatsBody:
      "Choisis le type, choisis la qualité, télécharge. ffmpeg est embarqué, rien à installer en plus.",
    featureI18nTitle: 'Sombre par défaut, 7 langues',
    featureI18nBody:
      "Anglais, français, espagnol, arabe (RTL), japonais, chinois, islandais. Bascule de thème à tout moment.",
    featureNativeTitle: 'Léger, rapide, natif',
    featureNativeBody:
      "Construit sur Tauri. Petit binaire, vraie fenêtre OS, pas de bloat Electron, pas de télémétrie.",
    featureSoonTitle: 'Spotify et Deezer bientôt',
    featureSoonBody:
      "Workflow match-via-YouTube en cours de design. Templates déjà dans l'UI, derrière un flag coming-soon.",
    featureOssTitle: 'Open source',
    featureOssBody:
      'Sous licence MIT. Lis le code, ouvre une issue, envoie une PR. Mêmes règles pour tout le monde.',
    footerCopy: 'Contributeurs Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Bientôt',
  },

  es: {
    navFeatures: 'Características',
    navDownload: 'Descargar',
    heroLine1: 'Pega una URL,',
    heroLine2: 'recibe el archivo.',
    heroDesc:
      'Descargador de medios moderno y ligero para Windows y Android. YouTube, SoundCloud y muchos sitios más. Vídeo MP4 o audio MP3. Oscuro por defecto. 7 idiomas.',
    heroCtaPrimary: 'Descargar gratis',
    heroCtaSecondary: 'Ver el código',
    downloadsTitle: 'Elige tu plataforma',
    downloadsSubtitle: 'Gratis. Sin cuenta. Sin anuncios. Sin telemetría.',
    downloadsHint:
      'Las builds de Windows aún no están firmadas — SmartScreen puede marcarlas. Pulsa "Más información → Ejecutar de todos modos". El APK de Android requiere permitir instalaciones de orígenes desconocidos para el archivo descargado.',
    windowsLabel: 'Windows',
    windowsSub: 'Instalador .exe',
    androidLabel: 'Android',
    androidSub: 'Sideload .apk',
    macosLabel: 'macOS',
    macosSub: 'próximamente',
    linuxLabel: 'Linux',
    linuxSub: 'próximamente',
    hoverCta: 'Pulsa para descargar →',
    featuresTitle: 'Lo que hace, lo que no hace.',
    featureYtTitle: 'YouTube y SoundCloud, hoy',
    featureYtBody:
      'Y muchos otros sitios soportados por yt-dlp. Pega la URL, la app se encarga del resto.',
    featureFormatsTitle: 'Vídeo MP4 o audio MP3',
    featureFormatsBody:
      'Elige el tipo, elige la calidad, descarga. ffmpeg viene incluido, sin instalación extra.',
    featureI18nTitle: 'Oscuro por defecto, 7 idiomas',
    featureI18nBody:
      'Inglés, francés, español, árabe (RTL), japonés, chino, islandés. Cambia el tema cuando quieras.',
    featureNativeTitle: 'Ligero, rápido, nativo',
    featureNativeBody:
      'Hecho con Tauri. Binario diminuto, ventana nativa real, sin bloat de Electron, sin telemetría.',
    featureSoonTitle: 'Spotify y Deezer pronto',
    featureSoonBody:
      'Flujo match-vía-YouTube en diseño. Plantillas ya en la UI, detrás de un flag coming-soon.',
    featureOssTitle: 'Código abierto',
    featureOssBody:
      'Licencia MIT. Lee el código, abre una issue, envía una PR. Las mismas reglas para todos.',
    footerCopy: 'Contribuidores de Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Próximamente',
  },

  ar: {
    navFeatures: 'المميزات',
    navDownload: 'تنزيل',
    heroLine1: 'ألصِق رابطًا،',
    heroLine2: 'احصل على الملف.',
    heroDesc:
      'تطبيق حديث وخفيف لتنزيل الوسائط على Windows و Android. يوتيوب، ساوند كلاود، والعديد من المواقع. فيديو MP4 أو صوت MP3. الوضع الداكن افتراضيًا. 7 لغات.',
    heroCtaPrimary: 'تنزيل مجاني',
    heroCtaSecondary: 'عرض المصدر',
    downloadsTitle: 'اختر منصتك',
    downloadsSubtitle: 'مجاني. بدون حساب. بدون إعلانات. بدون تتبع.',
    downloadsHint:
      'إصدارات Windows غير موقعة حاليًا — قد يحذرك SmartScreen. اضغط "مزيد من المعلومات ← التشغيل على أي حال". يتطلب APK تفعيل التثبيت من مصادر غير معروفة للملف الذي نزّلته.',
    windowsLabel: 'Windows',
    windowsSub: 'مثبت ‎.exe',
    androidLabel: 'Android',
    androidSub: 'تثبيت ‎.apk',
    macosLabel: 'macOS',
    macosSub: 'قريبًا',
    linuxLabel: 'Linux',
    linuxSub: 'قريبًا',
    hoverCta: 'اضغط للتنزيل ←',
    featuresTitle: 'ما يفعله، وما لا يفعله.',
    featureYtTitle: 'يوتيوب وساوند كلاود اليوم',
    featureYtBody:
      'وعدد كبير من المواقع الأخرى التي يدعمها yt-dlp. ألصِق الرابط، والتطبيق يتولى الباقي.',
    featureFormatsTitle: 'فيديو MP4 أو صوت MP3',
    featureFormatsBody:
      'اختر النوع، اختر الجودة، نزّل. ffmpeg مرفق، لا حاجة لتثبيت إضافي.',
    featureI18nTitle: 'داكن افتراضيًا، 7 لغات',
    featureI18nBody:
      'الإنجليزية، الفرنسية، الإسبانية، العربية (RTL)، اليابانية، الصينية، الأيسلندية. بدّل السمة في أي وقت.',
    featureNativeTitle: 'خفيف وسريع وأصلي',
    featureNativeBody:
      'مبني على Tauri. ملف صغير، نافذة نظام حقيقية، بلا تضخم Electron، بلا تتبع.',
    featureSoonTitle: 'Spotify و Deezer قريبًا',
    featureSoonBody:
      'سير عمل المطابقة عبر YouTube قيد التصميم. القوالب موجودة في الواجهة وراء علامة قريبًا.',
    featureOssTitle: 'مفتوح المصدر',
    featureOssBody:
      'ترخيص MIT. اقرأ الكود، افتح Issue، أرسل PR. نفس القواعد للجميع.',
    footerCopy: 'مساهمو Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'قريبًا',
  },

  ja: {
    navFeatures: '機能',
    navDownload: 'ダウンロード',
    heroLine1: 'URLを貼って、',
    heroLine2: 'ファイルをゲット。',
    heroDesc:
      'Windows と Android 向けのモダンで軽量なメディアダウンローダー。YouTube、SoundCloud、その他多数のサイト対応。MP4動画またはMP3音声。デフォルトはダーク。7言語対応。',
    heroCtaPrimary: '無料でダウンロード',
    heroCtaSecondary: 'ソースを見る',
    downloadsTitle: 'プラットフォームを選択',
    downloadsSubtitle: '無料。アカウント不要。広告なし。テレメトリなし。',
    downloadsHint:
      'Windows ビルドはまだ未署名 — SmartScreen に警告される場合があります。「詳細情報 → 実行」をクリック。Android APK は不明なソースからのインストール許可が必要です。',
    windowsLabel: 'Windows',
    windowsSub: '.exe インストーラ',
    androidLabel: 'Android',
    androidSub: '.apk サイドロード',
    macosLabel: 'macOS',
    macosSub: '近日対応',
    linuxLabel: 'Linux',
    linuxSub: '近日対応',
    hoverCta: 'クリックでダウンロード →',
    featuresTitle: '何ができて、何ができないか。',
    featureYtTitle: 'YouTube と SoundCloud は今日から',
    featureYtBody:
      'さらに yt-dlp が対応する多数のサイト。URLを貼るだけで、あとはアプリにお任せ。',
    featureFormatsTitle: 'MP4動画 または MP3音声',
    featureFormatsBody:
      '種類を選び、画質を選び、ダウンロード。ffmpeg 同梱、追加インストール不要。',
    featureI18nTitle: 'ダークがデフォルト、7言語',
    featureI18nBody:
      '英語、フランス語、スペイン語、アラビア語（RTL）、日本語、中国語、アイスランド語。テーマはいつでも切り替え可能。',
    featureNativeTitle: '軽量、高速、ネイティブ',
    featureNativeBody:
      'Tauri 製。極小バイナリ、本物の OS ウィンドウ、Electron 肥大化なし、テレメトリなし。',
    featureSoonTitle: 'Spotify と Deezer は近日対応',
    featureSoonBody:
      'YouTube 経由マッチワークフロー設計中。UI内にテンプレート配置済み、coming-soon フラグの裏側で。',
    featureOssTitle: 'オープンソース',
    featureOssBody:
      'MIT ライセンス。コードを読み、Issue を立て、PR を送る。みんな同じルール。',
    footerCopy: 'Patotube コントリビューター · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: '近日対応',
  },

  zh: {
    navFeatures: '功能',
    navDownload: '下载',
    heroLine1: '粘贴链接，',
    heroLine2: '获取文件。',
    heroDesc:
      '面向 Windows 和 Android 的现代轻量媒体下载器。支持 YouTube、SoundCloud 及众多网站。MP4 视频或 MP3 音频。默认深色模式。7 种语言。',
    heroCtaPrimary: '免费下载',
    heroCtaSecondary: '查看源码',
    downloadsTitle: '选择你的平台',
    downloadsSubtitle: '免费。无账号。无广告。无数据采集。',
    downloadsHint:
      'Windows 安装包目前未签名 —— SmartScreen 可能会提示。点击"更多信息 → 仍要运行"。Android APK 需要为下载的文件启用未知来源安装。',
    windowsLabel: 'Windows',
    windowsSub: '.exe 安装包',
    androidLabel: 'Android',
    androidSub: '.apk 旁加载',
    macosLabel: 'macOS',
    macosSub: '即将支持',
    linuxLabel: 'Linux',
    linuxSub: '即将支持',
    hoverCta: '点击下载 →',
    featuresTitle: '它能做什么，不能做什么。',
    featureYtTitle: 'YouTube 和 SoundCloud，今天就用',
    featureYtBody:
      '以及 yt-dlp 支持的众多网站。粘贴链接，剩下的交给应用。',
    featureFormatsTitle: 'MP4 视频或 MP3 音频',
    featureFormatsBody:
      '选类型，选画质，下载。ffmpeg 已内置，无需额外安装。',
    featureI18nTitle: '深色为默认，7 种语言',
    featureI18nBody:
      '英语、法语、西班牙语、阿拉伯语（RTL）、日语、中文、冰岛语。主题随时切换。',
    featureNativeTitle: '轻盈、快速、原生',
    featureNativeBody:
      '基于 Tauri 构建。体积极小，真正的系统窗口，没有 Electron 臃肿，没有遥测。',
    featureSoonTitle: 'Spotify 和 Deezer 即将到来',
    featureSoonBody:
      '通过 YouTube 匹配的工作流正在设计。UI 中已有占位模板，coming-soon 标记下。',
    featureOssTitle: '开源',
    featureOssBody:
      'MIT 许可证。读代码、提 Issue、发 PR。规则对所有人一样。',
    footerCopy: 'Patotube 贡献者 · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: '即将支持',
  },

  is: {
    navFeatures: 'Eiginleikar',
    navDownload: 'Sækja',
    heroLine1: 'Límdu inn slóð,',
    heroLine2: 'fáðu skrána.',
    heroDesc:
      'Nútímalegur og léttur miðlasækir fyrir Windows og Android. YouTube, SoundCloud og margar fleiri síður. MP4 myndband eða MP3 hljóð. Dökkt sjálfgefið. 7 tungumál.',
    heroCtaPrimary: 'Sækja ókeypis',
    heroCtaSecondary: 'Skoða kóða',
    downloadsTitle: 'Veldu vettvang',
    downloadsSubtitle: 'Ókeypis. Engin reikningur. Engar auglýsingar. Engin gögn söfnuð.',
    downloadsHint:
      'Windows útgáfur eru ekki undirritaðar enn — SmartScreen gæti merkt þær. Smelltu "More info → Run anyway". Android APK krefst þess að innsetning úr óþekktum aðilum sé virkjuð fyrir skrána sem þú sóttir.',
    windowsLabel: 'Windows',
    windowsSub: '.exe uppsetning',
    androidLabel: 'Android',
    androidSub: '.apk hliðarinnsetning',
    macosLabel: 'macOS',
    macosSub: 'á leiðinni',
    linuxLabel: 'Linux',
    linuxSub: 'á leiðinni',
    hoverCta: 'Smelltu til að sækja →',
    featuresTitle: 'Hvað það gerir, hvað það gerir ekki.',
    featureYtTitle: 'YouTube og SoundCloud, í dag',
    featureYtBody:
      'Og margar aðrar síður sem yt-dlp styður. Límdu inn slóðina, forritið sér um restina.',
    featureFormatsTitle: 'MP4 myndband eða MP3 hljóð',
    featureFormatsBody:
      'Veldu tegund, veldu gæði, sæktu. ffmpeg fylgir með, engin auka uppsetning.',
    featureI18nTitle: 'Dökkt sjálfgefið, 7 tungumál',
    featureI18nBody:
      'Enska, franska, spænska, arabíska (RTL), japanska, kínverska, íslenska. Skiptu um þema hvenær sem er.',
    featureNativeTitle: 'Létt, hratt, innfætt',
    featureNativeBody:
      'Byggt á Tauri. Lítill keyrsluskrá, alvöru kerfisgluggi, engin Electron þyngsli, engin gagnasöfnun.',
    featureSoonTitle: 'Spotify og Deezer á leiðinni',
    featureSoonBody:
      'Match-via-YouTube ferli í hönnun. Sniðmát eru þegar í viðmótinu undir coming-soon merki.',
    featureOssTitle: 'Opinn hugbúnaður',
    featureOssBody:
      'MIT leyfi. Lestu kóðann, settu Issue, sendu PR. Sömu reglur fyrir alla.',
    footerCopy: 'Patotube þátttakendur · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Á leiðinni',
  },
};
