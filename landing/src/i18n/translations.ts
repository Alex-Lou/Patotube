// Translations for the static landing. Kept inline so the page works
// without any extra fetch. Mirrors a subset of the desktop app's keys.

export const SUPPORTED = [
  'en',
  'fr',
  'es',
  'pt',
  'it',
  'de',
  'nl',
  'pl',
  'ru',
  'tr',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh',
  'is',
] as const;
export type LandingLocale = (typeof SUPPORTED)[number];

export const RTL = new Set<LandingLocale>(['ar']);

export const LOCALE_META: Record<
  LandingLocale,
  { native: string; flag: string; abbr: string }
> = {
  en: { native: 'English', flag: '🇬🇧', abbr: 'EN' },
  fr: { native: 'Français', flag: '🇫🇷', abbr: 'FR' },
  es: { native: 'Español', flag: '🇪🇸', abbr: 'ES' },
  pt: { native: 'Português', flag: '🇵🇹', abbr: 'PT' },
  it: { native: 'Italiano', flag: '🇮🇹', abbr: 'IT' },
  de: { native: 'Deutsch', flag: '🇩🇪', abbr: 'DE' },
  nl: { native: 'Nederlands', flag: '🇳🇱', abbr: 'NL' },
  pl: { native: 'Polski', flag: '🇵🇱', abbr: 'PL' },
  ru: { native: 'Русский', flag: '🇷🇺', abbr: 'RU' },
  tr: { native: 'Türkçe', flag: '🇹🇷', abbr: 'TR' },
  ar: { native: 'العربية', flag: '🇸🇦', abbr: 'AR' },
  hi: { native: 'हिन्दी', flag: '🇮🇳', abbr: 'HI' },
  ja: { native: '日本語', flag: '🇯🇵', abbr: 'JA' },
  ko: { native: '한국어', flag: '🇰🇷', abbr: 'KO' },
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

  pt: {
    navFeatures: 'Recursos',
    navDownload: 'Baixar',
    heroLine1: 'Cole uma URL,',
    heroLine2: 'receba o arquivo.',
    heroDesc:
      'Baixador de mídia moderno e leve para Windows e Android. YouTube, SoundCloud e muitos outros sites. Vídeo MP4 ou áudio MP3. Escuro por padrão. 16 idiomas.',
    heroCtaPrimary: 'Baixar grátis',
    heroCtaSecondary: 'Ver código',
    downloadsTitle: 'Escolha sua plataforma',
    downloadsSubtitle: 'Grátis. Sem conta. Sem anúncios. Sem telemetria.',
    downloadsHint:
      'Builds Windows ainda não estão assinadas — SmartScreen pode sinalizá-las. Clique "Mais informações → Executar mesmo assim". O APK Android requer ativar instalações de fontes desconhecidas para o arquivo baixado.',
    windowsLabel: 'Windows',
    windowsSub: 'Instalador .exe',
    androidLabel: 'Android',
    androidSub: 'Sideload .apk',
    macosLabel: 'macOS',
    macosSub: 'em breve',
    linuxLabel: 'Linux',
    linuxSub: 'em breve',
    hoverCta: 'Clique para baixar →',
    featuresTitle: 'O que faz, o que não faz.',
    featureYtTitle: 'YouTube e SoundCloud, hoje',
    featureYtBody:
      'E muitos outros sites suportados pelo yt-dlp. Cole a URL, o app cuida do resto.',
    featureFormatsTitle: 'Vídeo MP4 ou áudio MP3',
    featureFormatsBody:
      'Escolha o tipo, escolha a qualidade, baixe. ffmpeg incluído, sem instalação extra.',
    featureI18nTitle: 'Escuro por padrão, 16 idiomas',
    featureI18nBody:
      'Inglês, francês, espanhol, português, italiano, alemão, e outros. Alterne tema a qualquer momento.',
    featureNativeTitle: 'Leve, rápido, nativo',
    featureNativeBody:
      'Construído com Tauri. Binário pequeno, janela nativa real, sem inchaço Electron, sem telemetria.',
    featureSoonTitle: 'Spotify e Deezer em breve',
    featureSoonBody:
      'Fluxo match-via-YouTube em design. Templates já na UI, atrás de uma flag em breve.',
    featureOssTitle: 'Código aberto',
    featureOssBody:
      'Licença MIT. Leia o código, abra uma issue, envie um PR. Mesmas regras para todos.',
    footerCopy: 'Contribuidores Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Em breve',
  },

  it: {
    navFeatures: 'Funzionalità',
    navDownload: 'Scarica',
    heroLine1: 'Incolla un URL,',
    heroLine2: 'ottieni il file.',
    heroDesc:
      'Downloader multimediale moderno e leggero per Windows e Android. YouTube, SoundCloud e molti altri siti. Video MP4 o audio MP3. Scuro per impostazione predefinita. 16 lingue.',
    heroCtaPrimary: 'Scarica gratis',
    heroCtaSecondary: 'Vedi sorgente',
    downloadsTitle: 'Scegli la tua piattaforma',
    downloadsSubtitle: 'Gratis. Nessun account. Nessuna pubblicità. Nessuna telemetria.',
    downloadsHint:
      "Le build Windows non sono ancora firmate — SmartScreen potrebbe segnalarle. Clicca \"Ulteriori informazioni → Esegui comunque\". L'APK Android richiede di abilitare l'installazione da origini sconosciute per il file scaricato.",
    windowsLabel: 'Windows',
    windowsSub: 'Installer .exe',
    androidLabel: 'Android',
    androidSub: 'Sideload .apk',
    macosLabel: 'macOS',
    macosSub: 'prossimamente',
    linuxLabel: 'Linux',
    linuxSub: 'prossimamente',
    hoverCta: 'Clicca per scaricare →',
    featuresTitle: 'Cosa fa, cosa non fa.',
    featureYtTitle: 'YouTube e SoundCloud, oggi',
    featureYtBody:
      "E molti altri siti supportati da yt-dlp. Incolla l'URL, l'app si occupa del resto.",
    featureFormatsTitle: 'Video MP4 o audio MP3',
    featureFormatsBody:
      'Scegli il tipo, scegli la qualità, scarica. ffmpeg incluso, nessuna installazione extra.',
    featureI18nTitle: 'Scuro di default, 16 lingue',
    featureI18nBody:
      'Inglese, francese, spagnolo, italiano, tedesco, e altre. Cambia tema in qualsiasi momento.',
    featureNativeTitle: 'Leggero, veloce, nativo',
    featureNativeBody:
      'Costruito su Tauri. Binario minuscolo, finestra OS reale, senza bloat Electron, senza telemetria.',
    featureSoonTitle: 'Spotify e Deezer in arrivo',
    featureSoonBody:
      'Workflow match-via-YouTube in fase di design. Template già nella UI dietro un flag prossimamente.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'Licenza MIT. Leggi il codice, apri una issue, invia una PR. Stesse regole per tutti.',
    footerCopy: 'Contributori Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Prossimamente',
  },

  de: {
    navFeatures: 'Funktionen',
    navDownload: 'Herunterladen',
    heroLine1: 'URL einfügen,',
    heroLine2: 'Datei erhalten.',
    heroDesc:
      'Moderner, leichtgewichtiger Medien-Downloader für Windows und Android. YouTube, SoundCloud und viele weitere Seiten. MP4-Video oder MP3-Audio. Standardmäßig dunkel. 16 Sprachen.',
    heroCtaPrimary: 'Kostenlos herunterladen',
    heroCtaSecondary: 'Quellcode ansehen',
    downloadsTitle: 'Plattform auswählen',
    downloadsSubtitle: 'Kostenlos. Kein Konto. Keine Werbung. Keine Telemetrie.',
    downloadsHint:
      'Windows-Builds sind derzeit unsigniert — SmartScreen könnte sie melden. Klicken Sie "Weitere Informationen → Trotzdem ausführen". Das Android-APK erfordert die Aktivierung der Installation aus unbekannten Quellen für die heruntergeladene Datei.',
    windowsLabel: 'Windows',
    windowsSub: '.exe Installer',
    androidLabel: 'Android',
    androidSub: '.apk Sideload',
    macosLabel: 'macOS',
    macosSub: 'demnächst',
    linuxLabel: 'Linux',
    linuxSub: 'demnächst',
    hoverCta: 'Zum Herunterladen klicken →',
    featuresTitle: 'Was es kann, was es nicht kann.',
    featureYtTitle: 'YouTube und SoundCloud, heute',
    featureYtBody:
      'Und viele weitere Seiten, die yt-dlp beherrscht. URL einfügen, die App erledigt den Rest.',
    featureFormatsTitle: 'MP4-Video oder MP3-Audio',
    featureFormatsBody:
      'Typ wählen, Qualität wählen, herunterladen. ffmpeg enthalten, keine zusätzliche Installation.',
    featureI18nTitle: 'Standardmäßig dunkel, 16 Sprachen',
    featureI18nBody:
      'Englisch, Französisch, Spanisch, Deutsch, Italienisch, und mehr. Theme jederzeit wechseln.',
    featureNativeTitle: 'Leicht, schnell, nativ',
    featureNativeBody:
      'Auf Tauri basiert. Winzige Binary, echtes OS-Fenster, kein Electron-Ballast, keine Telemetrie.',
    featureSoonTitle: 'Spotify und Deezer demnächst',
    featureSoonBody:
      'Match-via-YouTube-Workflow in Planung. Templates bereits in der UI hinter einem demnächst-Flag.',
    featureOssTitle: 'Open Source',
    featureOssBody:
      'MIT-Lizenz. Code lesen, Issue eröffnen, PR senden. Gleiche Regeln für alle.',
    footerCopy: 'Patotube-Mitwirkende · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Demnächst',
  },

  nl: {
    navFeatures: 'Functies',
    navDownload: 'Downloaden',
    heroLine1: 'Plak een URL,',
    heroLine2: 'krijg het bestand.',
    heroDesc:
      'Moderne, lichtgewicht media-downloader voor Windows en Android. YouTube, SoundCloud en vele andere sites. MP4-video of MP3-audio. Donker standaard. 16 talen.',
    heroCtaPrimary: 'Gratis downloaden',
    heroCtaSecondary: 'Bekijk broncode',
    downloadsTitle: 'Kies je platform',
    downloadsSubtitle: 'Gratis. Geen account. Geen advertenties. Geen telemetrie.',
    downloadsHint:
      'Windows-builds zijn nog niet ondertekend — SmartScreen kan ze markeren. Klik "Meer info → Toch uitvoeren". Voor de Android-APK moet je installaties uit onbekende bronnen toestaan voor het gedownloade bestand.',
    windowsLabel: 'Windows',
    windowsSub: '.exe installer',
    androidLabel: 'Android',
    androidSub: '.apk sideload',
    macosLabel: 'macOS',
    macosSub: 'binnenkort',
    linuxLabel: 'Linux',
    linuxSub: 'binnenkort',
    hoverCta: 'Klik om te downloaden →',
    featuresTitle: 'Wat het doet, wat het niet doet.',
    featureYtTitle: 'YouTube en SoundCloud, vandaag',
    featureYtBody:
      'En vele andere sites die yt-dlp ondersteunt. Plak de URL, de app regelt de rest.',
    featureFormatsTitle: 'MP4-video of MP3-audio',
    featureFormatsBody:
      'Kies het type, kies de kwaliteit, download. ffmpeg meegeleverd, geen extra installatie.',
    featureI18nTitle: 'Donker standaard, 16 talen',
    featureI18nBody:
      'Engels, Frans, Spaans, Nederlands, Duits, en meer. Wissel thema wanneer je wilt.',
    featureNativeTitle: 'Licht, snel, native',
    featureNativeBody:
      'Gebouwd op Tauri. Klein binary, echt OS-venster, geen Electron-bloat, geen telemetrie.',
    featureSoonTitle: 'Spotify en Deezer binnenkort',
    featureSoonBody:
      'Match-via-YouTube workflow in ontwerp. Templates al in de UI achter een binnenkort-vlag.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'MIT-licentie. Lees de code, open een issue, stuur een PR. Zelfde regels voor iedereen.',
    footerCopy: 'Patotube-bijdragers · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Binnenkort',
  },

  pl: {
    navFeatures: 'Funkcje',
    navDownload: 'Pobierz',
    heroLine1: 'Wklej URL,',
    heroLine2: 'otrzymaj plik.',
    heroDesc:
      'Nowoczesny, lekki downloader mediów dla Windows i Android. YouTube, SoundCloud i wiele innych stron. Wideo MP4 lub audio MP3. Domyślnie ciemny. 16 języków.',
    heroCtaPrimary: 'Pobierz za darmo',
    heroCtaSecondary: 'Zobacz kod',
    downloadsTitle: 'Wybierz swoją platformę',
    downloadsSubtitle: 'Za darmo. Bez konta. Bez reklam. Bez telemetrii.',
    downloadsHint:
      'Buildy Windows nie są jeszcze podpisane — SmartScreen może je oznaczyć. Kliknij "Więcej informacji → Uruchom mimo to". APK Android wymaga włączenia instalacji z nieznanych źródeł dla pobranego pliku.',
    windowsLabel: 'Windows',
    windowsSub: 'Instalator .exe',
    androidLabel: 'Android',
    androidSub: 'Sideload .apk',
    macosLabel: 'macOS',
    macosSub: 'wkrótce',
    linuxLabel: 'Linux',
    linuxSub: 'wkrótce',
    hoverCta: 'Kliknij, aby pobrać →',
    featuresTitle: 'Co robi, czego nie robi.',
    featureYtTitle: 'YouTube i SoundCloud już dziś',
    featureYtBody:
      'Plus wiele innych stron obsługiwanych przez yt-dlp. Wklej URL, aplikacja zajmie się resztą.',
    featureFormatsTitle: 'Wideo MP4 lub audio MP3',
    featureFormatsBody:
      'Wybierz typ, wybierz jakość, pobierz. ffmpeg w pakiecie, bez dodatkowej instalacji.',
    featureI18nTitle: 'Domyślnie ciemny, 16 języków',
    featureI18nBody:
      'Angielski, francuski, hiszpański, polski, niemiecki, i więcej. Przełącz motyw kiedy chcesz.',
    featureNativeTitle: 'Lekki, szybki, natywny',
    featureNativeBody:
      'Zbudowany na Tauri. Mały plik binarny, prawdziwe okno OS, bez bloatu Electrona, bez telemetrii.',
    featureSoonTitle: 'Spotify i Deezer wkrótce',
    featureSoonBody:
      'Workflow match-via-YouTube w projektowaniu. Szablony już w UI za flagą wkrótce.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'Licencja MIT. Czytaj kod, otwórz issue, wyślij PR. Te same zasady dla wszystkich.',
    footerCopy: 'Współtwórcy Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Wkrótce',
  },

  ru: {
    navFeatures: 'Функции',
    navDownload: 'Скачать',
    heroLine1: 'Вставьте ссылку,',
    heroLine2: 'получите файл.',
    heroDesc:
      'Современный лёгкий загрузчик медиа для Windows и Android. YouTube, SoundCloud и множество других сайтов. Видео MP4 или аудио MP3. Тёмная тема по умолчанию. 16 языков.',
    heroCtaPrimary: 'Скачать бесплатно',
    heroCtaSecondary: 'Посмотреть код',
    downloadsTitle: 'Выберите платформу',
    downloadsSubtitle: 'Бесплатно. Без аккаунта. Без рекламы. Без телеметрии.',
    downloadsHint:
      'Сборки Windows пока не подписаны — SmartScreen может их пометить. Нажмите "Подробнее → Выполнить в любом случае". APK для Android требует включения установки из неизвестных источников для загруженного файла.',
    windowsLabel: 'Windows',
    windowsSub: 'Установщик .exe',
    androidLabel: 'Android',
    androidSub: 'Сайдлоад .apk',
    macosLabel: 'macOS',
    macosSub: 'скоро',
    linuxLabel: 'Linux',
    linuxSub: 'скоро',
    hoverCta: 'Нажмите для загрузки →',
    featuresTitle: 'Что делает, чего не делает.',
    featureYtTitle: 'YouTube и SoundCloud сегодня',
    featureYtBody:
      'И множество других сайтов, поддерживаемых yt-dlp. Вставьте ссылку — приложение разберётся.',
    featureFormatsTitle: 'Видео MP4 или аудио MP3',
    featureFormatsBody:
      'Выберите тип, выберите качество, загружайте. ffmpeg включён, без дополнительной установки.',
    featureI18nTitle: 'Тёмная тема, 16 языков',
    featureI18nBody:
      'Английский, французский, испанский, русский, немецкий и другие. Переключайте тему когда угодно.',
    featureNativeTitle: 'Лёгкий, быстрый, нативный',
    featureNativeBody:
      'Построен на Tauri. Крошечный бинарник, настоящее окно ОС, без раздутия Electron, без телеметрии.',
    featureSoonTitle: 'Spotify и Deezer скоро',
    featureSoonBody:
      'Workflow match-via-YouTube в разработке. Шаблоны уже в UI за флагом «скоро».',
    featureOssTitle: 'Открытый исходный код',
    featureOssBody:
      'Лицензия MIT. Читайте код, открывайте issue, отправляйте PR. Одни правила для всех.',
    footerCopy: 'Участники Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Скоро',
  },

  tr: {
    navFeatures: 'Özellikler',
    navDownload: 'İndir',
    heroLine1: 'URL yapıştır,',
    heroLine2: 'dosyayı al.',
    heroDesc:
      'Windows ve Android için modern, hafif medya indiricisi. YouTube, SoundCloud ve birçok diğer site. MP4 video veya MP3 ses. Varsayılan koyu tema. 16 dil.',
    heroCtaPrimary: 'Ücretsiz indir',
    heroCtaSecondary: 'Kaynağı görüntüle',
    downloadsTitle: 'Platformunu seç',
    downloadsSubtitle: 'Ücretsiz. Hesap yok. Reklam yok. Telemetri yok.',
    downloadsHint:
      'Windows derlemeleri şu anda imzasız — SmartScreen bunları işaretleyebilir. "Daha fazla bilgi → Yine de çalıştır" tıkla. Android APK için indirilen dosyaya bilinmeyen kaynaklardan kurulum izni vermen gerekir.',
    windowsLabel: 'Windows',
    windowsSub: '.exe yükleyici',
    androidLabel: 'Android',
    androidSub: '.apk sideload',
    macosLabel: 'macOS',
    macosSub: 'yakında',
    linuxLabel: 'Linux',
    linuxSub: 'yakında',
    hoverCta: 'İndirmek için tıkla →',
    featuresTitle: 'Neler yapar, neler yapmaz.',
    featureYtTitle: 'YouTube ve SoundCloud, bugün',
    featureYtBody:
      "Ve yt-dlp'nin desteklediği diğer birçok site. URL'yi yapıştır, uygulama gerisini halletsin.",
    featureFormatsTitle: 'MP4 video veya MP3 ses',
    featureFormatsBody:
      'Türü seç, kaliteyi seç, indir. ffmpeg pakete dahil, ekstra kurulum yok.',
    featureI18nTitle: 'Varsayılan koyu, 16 dil',
    featureI18nBody:
      'İngilizce, Fransızca, İspanyolca, Türkçe, Almanca ve daha fazlası. Temayı istediğin zaman değiştir.',
    featureNativeTitle: 'Hafif, hızlı, yerel',
    featureNativeBody:
      'Tauri üzerine kurulu. Minik bir ikili dosya, gerçek OS penceresi, Electron şişkinliği yok, telemetri yok.',
    featureSoonTitle: 'Spotify ve Deezer yakında',
    featureSoonBody:
      "Match-via-YouTube iş akışı tasarım aşamasında. Şablonlar zaten UI'da, yakında bayrağı arkasında.",
    featureOssTitle: 'Açık kaynak',
    featureOssBody:
      'MIT lisansı. Kodu oku, issue aç, PR gönder. Herkese aynı kurallar.',
    footerCopy: 'Patotube katkıda bulunanlar · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'Yakında',
  },

  hi: {
    navFeatures: 'सुविधाएँ',
    navDownload: 'डाउनलोड',
    heroLine1: 'URL पेस्ट करें,',
    heroLine2: 'फ़ाइल पाएं।',
    heroDesc:
      'Windows और Android के लिए आधुनिक, हल्का मीडिया डाउनलोडर। YouTube, SoundCloud और कई अन्य साइटें। MP4 वीडियो या MP3 ऑडियो। डिफ़ॉल्ट रूप से डार्क। 16 भाषाएँ।',
    heroCtaPrimary: 'मुफ़्त डाउनलोड करें',
    heroCtaSecondary: 'सोर्स देखें',
    downloadsTitle: 'अपना प्लेटफ़ॉर्म चुनें',
    downloadsSubtitle: 'मुफ़्त। कोई खाता नहीं। कोई विज्ञापन नहीं। कोई टेलीमेट्री नहीं।',
    downloadsHint:
      'Windows बिल्ड अभी हस्ताक्षरित नहीं हैं — SmartScreen उन्हें फ़्लैग कर सकता है। "अधिक जानकारी → फिर भी चलाएं" क्लिक करें। Android APK के लिए डाउनलोड की गई फ़ाइल हेतु अज्ञात स्रोतों से इंस्टॉल सक्षम करना होगा।',
    windowsLabel: 'Windows',
    windowsSub: '.exe इंस्टॉलर',
    androidLabel: 'Android',
    androidSub: '.apk साइडलोड',
    macosLabel: 'macOS',
    macosSub: 'जल्द आ रहा है',
    linuxLabel: 'Linux',
    linuxSub: 'जल्द आ रहा है',
    hoverCta: 'डाउनलोड के लिए क्लिक करें →',
    featuresTitle: 'क्या करता है, क्या नहीं।',
    featureYtTitle: 'YouTube और SoundCloud, आज',
    featureYtBody:
      'और yt-dlp द्वारा समर्थित कई अन्य साइटें। URL पेस्ट करें, ऐप बाकी संभालता है।',
    featureFormatsTitle: 'MP4 वीडियो या MP3 ऑडियो',
    featureFormatsBody:
      'प्रकार चुनें, गुणवत्ता चुनें, डाउनलोड करें। ffmpeg बंडल में शामिल, कोई अतिरिक्त इंस्टॉल नहीं।',
    featureI18nTitle: 'डिफ़ॉल्ट डार्क, 16 भाषाएँ',
    featureI18nBody:
      'अंग्रेज़ी, फ़्रेंच, स्पेनिश, हिन्दी, जर्मन, और अधिक। थीम कभी भी बदलें।',
    featureNativeTitle: 'हल्का, तेज़, मूल',
    featureNativeBody:
      'Tauri पर आधारित। छोटी बाइनरी, असली OS विंडो, कोई Electron ब्लोट नहीं, कोई टेलीमेट्री नहीं।',
    featureSoonTitle: 'Spotify और Deezer जल्द आ रहे हैं',
    featureSoonBody:
      'Match-via-YouTube वर्कफ़्लो डिज़ाइन में। UI में टेम्पलेट पहले से हैं, coming-soon फ़्लैग के पीछे।',
    featureOssTitle: 'ओपन सोर्स',
    featureOssBody:
      'MIT लाइसेंस। कोड पढ़ें, इश्यू दर्ज करें, PR भेजें। सभी के लिए समान नियम।',
    footerCopy: 'Patotube योगदानकर्ता · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: 'जल्द आ रहा है',
  },

  ko: {
    navFeatures: '기능',
    navDownload: '다운로드',
    heroLine1: 'URL을 붙여넣고,',
    heroLine2: '파일을 받으세요.',
    heroDesc:
      'Windows와 Android를 위한 현대적이고 가벼운 미디어 다운로더. YouTube, SoundCloud 및 다양한 사이트. MP4 비디오 또는 MP3 오디오. 기본 다크 모드. 16개 언어.',
    heroCtaPrimary: '무료 다운로드',
    heroCtaSecondary: '소스 보기',
    downloadsTitle: '플랫폼 선택',
    downloadsSubtitle: '무료. 계정 불필요. 광고 없음. 텔레메트리 없음.',
    downloadsHint:
      'Windows 빌드는 아직 서명되지 않음 — SmartScreen이 경고할 수 있습니다. "추가 정보 → 실행"을 클릭하세요. Android APK는 다운로드한 파일에 대해 알 수 없는 출처에서 설치를 허용해야 합니다.',
    windowsLabel: 'Windows',
    windowsSub: '.exe 설치 프로그램',
    androidLabel: 'Android',
    androidSub: '.apk 사이드로드',
    macosLabel: 'macOS',
    macosSub: '출시 예정',
    linuxLabel: 'Linux',
    linuxSub: '출시 예정',
    hoverCta: '클릭하여 다운로드 →',
    featuresTitle: '무엇을 하고 무엇을 하지 않는가.',
    featureYtTitle: 'YouTube와 SoundCloud, 오늘부터',
    featureYtBody:
      '그리고 yt-dlp가 지원하는 여러 다른 사이트. URL을 붙여넣으면 앱이 알아서 처리합니다.',
    featureFormatsTitle: 'MP4 비디오 또는 MP3 오디오',
    featureFormatsBody:
      '종류를 고르고, 품질을 고르고, 다운로드. ffmpeg 번들 포함, 추가 설치 불필요.',
    featureI18nTitle: '기본 다크, 16개 언어',
    featureI18nBody:
      '영어, 프랑스어, 스페인어, 한국어, 독일어 등. 언제든지 테마 전환.',
    featureNativeTitle: '가볍고, 빠르고, 네이티브',
    featureNativeBody:
      'Tauri 기반. 작은 바이너리, 진짜 OS 창, Electron 비대화 없음, 텔레메트리 없음.',
    featureSoonTitle: 'Spotify와 Deezer 곧 출시',
    featureSoonBody:
      'YouTube 매칭 워크플로우 설계 중. UI에 템플릿 이미 있음, coming-soon 플래그 뒤.',
    featureOssTitle: '오픈 소스',
    featureOssBody:
      'MIT 라이선스. 코드를 읽고, 이슈를 등록하고, PR을 보내세요. 모두에게 같은 규칙.',
    footerCopy: 'Patotube 기여자 · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: '출시 예정',
  },
};
