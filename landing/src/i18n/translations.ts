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
      'Modern, lightweight media downloader for Windows and Android. YouTube and SoundCloud. MP4 video or MP3 audio. Dark by default. 16 languages.',
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
    featureYtTitle: 'YouTube and SoundCloud',
    featureYtBody:
      'Paste your link, the app handles the rest. Spotify and Deezer matching on the way.',
    featureFormatsTitle: 'MP4 video or MP3 audio',
    featureFormatsBody:
      'Pick the kind, pick the quality, hit download. ffmpeg ships in the bundle, no extra install.',
    featureI18nTitle: 'Dark by default, 16 languages',
    featureI18nBody:
      'English, French, Spanish, Portuguese, Italian, German, Arabic (RTL), Japanese, Chinese and more. Toggle theme any time.',
    featureNativeTitle: 'Light, fast, native',
    featureNativeBody:
      'Built on Tauri. Tiny binary, a real OS window, no telemetry, no tracking.',
    featureSoonTitle: 'Spotify and Deezer soon',
    featureSoonBody:
      'Coming soon: paste a Spotify or Deezer link, the app will fetch the matching track. UI is already there, the engine is being built.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'MIT licensed. The whole codebase is on GitHub — read it, report bugs, suggest improvements.',
    footerCopy: 'Patotube · MIT',
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
      "Téléchargeur média moderne et léger pour Windows et Android. YouTube et SoundCloud. Vidéo MP4 ou audio MP3. Mode sombre par défaut. 16 langues.",
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
    featureYtTitle: "YouTube et SoundCloud",
    featureYtBody:
      "Colle ton lien, l'app gère le reste. Matching Spotify et Deezer en cours.",
    featureFormatsTitle: 'Vidéo MP4 ou audio MP3',
    featureFormatsBody:
      "Choisis le type, choisis la qualité, télécharge. ffmpeg est embarqué, rien à installer en plus.",
    featureI18nTitle: 'Sombre par défaut, 16 langues',
    featureI18nBody:
      "Anglais, français, espagnol, portugais, italien, allemand, arabe (RTL), japonais, chinois et plus. Bascule de thème à tout moment.",
    featureNativeTitle: 'Léger, rapide, natif',
    featureNativeBody:
      "Construit sur Tauri. Petit binaire, vraie fenêtre native, aucun tracker, aucune télémétrie.",
    featureSoonTitle: 'Spotify et Deezer bientôt',
    featureSoonBody:
      "Bientôt : colle un lien Spotify ou Deezer, l'app ira chercher le morceau équivalent. L'interface est prête, le moteur est en construction.",
    featureOssTitle: 'Open source',
    featureOssBody:
      "Sous licence MIT. Tout le code est sur GitHub — lis-le, signale un bug, propose une amélioration.",
    footerCopy: 'Patotube · MIT',
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
      'Descargador de medios moderno y ligero para Windows y Android. YouTube y SoundCloud. Vídeo MP4 o audio MP3. Oscuro por defecto. 16 idiomas.',
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
    featureYtTitle: 'YouTube y SoundCloud',
    featureYtBody:
      'Pega tu enlace, la app se encarga del resto. Matching Spotify y Deezer en camino.',
    featureFormatsTitle: 'Vídeo MP4 o audio MP3',
    featureFormatsBody:
      'Elige el tipo, elige la calidad, descarga. ffmpeg viene incluido, sin instalación extra.',
    featureI18nTitle: 'Oscuro por defecto, 16 idiomas',
    featureI18nBody:
      'Inglés, francés, español, portugués, italiano, alemán, árabe (RTL), japonés, chino y más. Cambia el tema cuando quieras.',
    featureNativeTitle: 'Ligero, rápido, nativo',
    featureNativeBody:
      'Hecho con Tauri. Binario diminuto, ventana nativa real, sin trackers, sin telemetría.',
    featureSoonTitle: 'Spotify y Deezer pronto',
    featureSoonBody:
      'Próximamente: pega un enlace de Spotify o Deezer y la app buscará el equivalente. La interfaz está lista, el motor está en construcción.',
    featureOssTitle: 'Código abierto',
    featureOssBody:
      'Licencia MIT. Todo el código está en GitHub — léelo, reporta un bug, propone una mejora.',
    footerCopy: 'Patotube · MIT',
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
      'تطبيق حديث وخفيف لتنزيل الوسائط على Windows و Android. يوتيوب وساوند كلاود. فيديو MP4 أو صوت MP3. الوضع الداكن افتراضيًا. 16 لغة.',
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
    featureYtTitle: 'يوتيوب وساوند كلاود',
    featureYtBody:
      'ألصِق رابطك والتطبيق يتولى الباقي. مطابقة Spotify وDeezer قريبًا.',
    featureFormatsTitle: 'فيديو MP4 أو صوت MP3',
    featureFormatsBody:
      'اختر النوع، اختر الجودة، نزّل. ffmpeg مرفق، لا حاجة لتثبيت إضافي.',
    featureI18nTitle: 'داكن افتراضيًا، 16 لغة',
    featureI18nBody:
      'الإنجليزية، الفرنسية، الإسبانية، البرتغالية، الإيطالية، الألمانية، العربية (RTL)، اليابانية، الصينية والمزيد. بدّل السمة في أي وقت.',
    featureNativeTitle: 'خفيف وسريع وأصلي',
    featureNativeBody:
      'مبني على Tauri. ملف صغير، نافذة نظام حقيقية، بلا متتبعات، بلا تتبع.',
    featureSoonTitle: 'Spotify و Deezer قريبًا',
    featureSoonBody:
      'قريبًا: ألصق رابط Spotify أو Deezer وسيبحث التطبيق عن المسار المماثل. الواجهة جاهزة، المحرك قيد البناء.',
    featureOssTitle: 'مفتوح المصدر',
    featureOssBody:
      'ترخيص MIT. الكود بأكمله على GitHub — اقرأه، أبلغ عن خطأ، اقترح تحسينًا.',
    footerCopy: 'Patotube · MIT',
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
      'Windows と Android 向けのモダンで軽量なメディアダウンローダー。YouTube と SoundCloud。MP4動画またはMP3音声。デフォルトはダーク。16言語対応。',
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
    featureYtTitle: 'YouTube と SoundCloud',
    featureYtBody:
      'リンクを貼り付ければ、あとはアプリにお任せ。Spotify と Deezer マッチング対応予定。',
    featureFormatsTitle: 'MP4動画 または MP3音声',
    featureFormatsBody:
      '種類を選び、画質を選び、ダウンロード。ffmpeg 同梱、追加インストール不要。',
    featureI18nTitle: 'ダークがデフォルト、16言語',
    featureI18nBody:
      '英語、フランス語、スペイン語、ポルトガル語、イタリア語、ドイツ語、アラビア語（RTL）、日本語、中国語など。テーマはいつでも切り替え可能。',
    featureNativeTitle: '軽量、高速、ネイティブ',
    featureNativeBody:
      'Tauri 製。極小バイナリ、本物の OS ウィンドウ、トラッカーなし、テレメトリなし。',
    featureSoonTitle: 'Spotify と Deezer は近日対応',
    featureSoonBody:
      '近日対応：Spotify や Deezer のリンクを貼ると、アプリが対応する曲を取得します。UI は完成、エンジンは構築中。',
    featureOssTitle: 'オープンソース',
    featureOssBody:
      'MIT ライセンス。コードはすべて GitHub 上 — 読んで、バグ報告、改善提案を。',
    footerCopy: 'Patotube · MIT',
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
      '面向 Windows 和 Android 的现代轻量媒体下载器。支持 YouTube 和 SoundCloud。MP4 视频或 MP3 音频。默认深色模式。16 种语言。',
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
    featureYtTitle: 'YouTube 和 SoundCloud',
    featureYtBody:
      '粘贴你的链接，剩下的交给应用。Spotify 和 Deezer 匹配即将到来。',
    featureFormatsTitle: 'MP4 视频或 MP3 音频',
    featureFormatsBody:
      '选类型，选画质，下载。ffmpeg 已内置，无需额外安装。',
    featureI18nTitle: '深色为默认，16 种语言',
    featureI18nBody:
      '英语、法语、西班牙语、葡萄牙语、意大利语、德语、阿拉伯语（RTL）、日语、中文等。主题随时切换。',
    featureNativeTitle: '轻盈、快速、原生',
    featureNativeBody:
      '基于 Tauri 构建。体积极小，真正的系统窗口，无追踪，无遥测。',
    featureSoonTitle: 'Spotify 和 Deezer 即将到来',
    featureSoonBody:
      '即将支持：粘贴 Spotify 或 Deezer 链接，应用会获取对应的曲目。UI 已就绪，引擎正在构建中。',
    featureOssTitle: '开源',
    featureOssBody:
      'MIT 许可证。所有代码都在 GitHub 上 — 阅读、报告 bug、提出改进。',
    footerCopy: 'Patotube · MIT',
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
      'Nútímalegur og léttur miðlasækir fyrir Windows og Android. YouTube og SoundCloud. MP4 myndband eða MP3 hljóð. Dökkt sjálfgefið. 16 tungumál.',
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
    featureYtTitle: 'YouTube og SoundCloud',
    featureYtBody:
      'Límdu inn slóðina, forritið sér um restina. Spotify og Deezer pörun á leiðinni.',
    featureFormatsTitle: 'MP4 myndband eða MP3 hljóð',
    featureFormatsBody:
      'Veldu tegund, veldu gæði, sæktu. ffmpeg fylgir með, engin auka uppsetning.',
    featureI18nTitle: 'Dökkt sjálfgefið, 16 tungumál',
    featureI18nBody:
      'Enska, franska, spænska, portúgalska, ítalska, þýska, arabíska (RTL), japanska, kínverska og fleira. Skiptu um þema hvenær sem er.',
    featureNativeTitle: 'Létt, hratt, innfætt',
    featureNativeBody:
      'Byggt á Tauri. Lítill keyrsluskrá, alvöru kerfisgluggi, engar njósnir, engin gagnasöfnun.',
    featureSoonTitle: 'Spotify og Deezer á leiðinni',
    featureSoonBody:
      'Á leiðinni: límdu Spotify eða Deezer hlekk, forritið mun finna samsvarandi lag. Viðmótið er tilbúið, vélin er í smíðum.',
    featureOssTitle: 'Opinn hugbúnaður',
    featureOssBody:
      'MIT leyfi. Allur kóðinn er á GitHub — lestu hann, tilkynntu villu, leggðu til endurbætur.',
    footerCopy: 'Patotube · MIT',
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
      'Baixador de mídia moderno e leve para Windows e Android. YouTube e SoundCloud. Vídeo MP4 ou áudio MP3. Escuro por padrão. 16 idiomas.',
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
    featureYtTitle: 'YouTube e SoundCloud',
    featureYtBody:
      'Cole seu link, o app cuida do resto. Matching Spotify e Deezer em breve.',
    featureFormatsTitle: 'Vídeo MP4 ou áudio MP3',
    featureFormatsBody:
      'Escolha o tipo, escolha a qualidade, baixe. ffmpeg incluído, sem instalação extra.',
    featureI18nTitle: 'Escuro por padrão, 16 idiomas',
    featureI18nBody:
      'Inglês, francês, espanhol, português, italiano, alemão, e outros. Alterne tema a qualquer momento.',
    featureNativeTitle: 'Leve, rápido, nativo',
    featureNativeBody:
      'Construído com Tauri. Binário pequeno, janela nativa real, sem rastreamento, sem telemetria.',
    featureSoonTitle: 'Spotify e Deezer em breve',
    featureSoonBody:
      'Em breve: cole um link do Spotify ou Deezer e o app buscará a faixa correspondente. A interface está pronta, o motor está em construção.',
    featureOssTitle: 'Código aberto',
    featureOssBody:
      'Licença MIT. Todo o código está no GitHub — leia, reporte bugs, sugira melhorias.',
    footerCopy: 'Patotube · MIT',
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
      'Downloader multimediale moderno e leggero per Windows e Android. YouTube e SoundCloud. Video MP4 o audio MP3. Scuro per impostazione predefinita. 16 lingue.',
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
    featureYtTitle: 'YouTube e SoundCloud',
    featureYtBody:
      "Incolla il tuo link, l'app si occupa del resto. Matching Spotify e Deezer in arrivo.",
    featureFormatsTitle: 'Video MP4 o audio MP3',
    featureFormatsBody:
      'Scegli il tipo, scegli la qualità, scarica. ffmpeg incluso, nessuna installazione extra.',
    featureI18nTitle: 'Scuro di default, 16 lingue',
    featureI18nBody:
      'Inglese, francese, spagnolo, italiano, tedesco, e altre. Cambia tema in qualsiasi momento.',
    featureNativeTitle: 'Leggero, veloce, nativo',
    featureNativeBody:
      'Costruito su Tauri. Binario minuscolo, finestra nativa reale, senza tracker, senza telemetria.',
    featureSoonTitle: 'Spotify e Deezer in arrivo',
    featureSoonBody:
      "Prossimamente: incolla un link Spotify o Deezer e l'app troverà il brano corrispondente. L'interfaccia è pronta, il motore è in costruzione.",
    featureOssTitle: 'Open source',
    featureOssBody:
      'Licenza MIT. Tutto il codice è su GitHub — leggilo, segnala bug, proponi miglioramenti.',
    footerCopy: 'Patotube · MIT',
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
      'Moderner, leichtgewichtiger Medien-Downloader für Windows und Android. YouTube und SoundCloud. MP4-Video oder MP3-Audio. Standardmäßig dunkel. 16 Sprachen.',
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
    featureYtTitle: 'YouTube und SoundCloud',
    featureYtBody:
      'Link einfügen, die App erledigt den Rest. Spotify- und Deezer-Matching in Arbeit.',
    featureFormatsTitle: 'MP4-Video oder MP3-Audio',
    featureFormatsBody:
      'Typ wählen, Qualität wählen, herunterladen. ffmpeg enthalten, keine zusätzliche Installation.',
    featureI18nTitle: 'Standardmäßig dunkel, 16 Sprachen',
    featureI18nBody:
      'Englisch, Französisch, Spanisch, Deutsch, Italienisch, und mehr. Theme jederzeit wechseln.',
    featureNativeTitle: 'Leicht, schnell, nativ',
    featureNativeBody:
      'Auf Tauri basiert. Winzige Binary, echtes OS-Fenster, kein Tracking, keine Telemetrie.',
    featureSoonTitle: 'Spotify und Deezer demnächst',
    featureSoonBody:
      'Demnächst: Spotify- oder Deezer-Link einfügen, die App findet den passenden Track. Die Oberfläche ist fertig, der Motor wird gebaut.',
    featureOssTitle: 'Open Source',
    featureOssBody:
      'MIT-Lizenz. Der gesamte Code liegt auf GitHub — lies ihn, melde Bugs, schlage Verbesserungen vor.',
    footerCopy: 'Patotube · MIT',
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
      'Moderne, lichtgewicht media-downloader voor Windows en Android. YouTube en SoundCloud. MP4-video of MP3-audio. Donker standaard. 16 talen.',
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
    featureYtTitle: 'YouTube en SoundCloud',
    featureYtBody:
      'Plak je link, de app regelt de rest. Spotify- en Deezer-matching is op komst.',
    featureFormatsTitle: 'MP4-video of MP3-audio',
    featureFormatsBody:
      'Kies het type, kies de kwaliteit, download. ffmpeg meegeleverd, geen extra installatie.',
    featureI18nTitle: 'Donker standaard, 16 talen',
    featureI18nBody:
      'Engels, Frans, Spaans, Nederlands, Duits, en meer. Wissel thema wanneer je wilt.',
    featureNativeTitle: 'Licht, snel, native',
    featureNativeBody:
      'Gebouwd op Tauri. Klein binary, echt OS-venster, geen tracking, geen telemetrie.',
    featureSoonTitle: 'Spotify en Deezer binnenkort',
    featureSoonBody:
      'Binnenkort: plak een Spotify- of Deezer-link en de app zoekt de bijpassende track. De interface is klaar, de motor wordt gebouwd.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'MIT-licentie. Alle code staat op GitHub — lees het, meld bugs, stel verbeteringen voor.',
    footerCopy: 'Patotube · MIT',
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
      'Nowoczesny, lekki downloader mediów dla Windows i Android. YouTube i SoundCloud. Wideo MP4 lub audio MP3. Domyślnie ciemny. 16 języków.',
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
    featureYtTitle: 'YouTube i SoundCloud',
    featureYtBody:
      'Wklej swój link, aplikacja zajmie się resztą. Dopasowanie Spotify i Deezer wkrótce.',
    featureFormatsTitle: 'Wideo MP4 lub audio MP3',
    featureFormatsBody:
      'Wybierz typ, wybierz jakość, pobierz. ffmpeg w pakiecie, bez dodatkowej instalacji.',
    featureI18nTitle: 'Domyślnie ciemny, 16 języków',
    featureI18nBody:
      'Angielski, francuski, hiszpański, polski, niemiecki, i więcej. Przełącz motyw kiedy chcesz.',
    featureNativeTitle: 'Lekki, szybki, natywny',
    featureNativeBody:
      'Zbudowany na Tauri. Mały plik binarny, prawdziwe okno OS, bez śledzenia, bez telemetrii.',
    featureSoonTitle: 'Spotify i Deezer wkrótce',
    featureSoonBody:
      'Wkrótce: wklej link Spotify lub Deezer, a aplikacja znajdzie pasujący utwór. Interfejs gotowy, silnik w budowie.',
    featureOssTitle: 'Open source',
    featureOssBody:
      'Licencja MIT. Cały kod jest na GitHubie — przeczytaj, zgłoś bug, zaproponuj ulepszenie.',
    footerCopy: 'Patotube · MIT',
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
      'Современный лёгкий загрузчик медиа для Windows и Android. YouTube и SoundCloud. Видео MP4 или аудио MP3. Тёмная тема по умолчанию. 16 языков.',
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
    featureYtTitle: 'YouTube и SoundCloud',
    featureYtBody:
      'Вставьте ссылку — приложение разберётся. Сопоставление Spotify и Deezer скоро.',
    featureFormatsTitle: 'Видео MP4 или аудио MP3',
    featureFormatsBody:
      'Выберите тип, выберите качество, загружайте. ffmpeg включён, без дополнительной установки.',
    featureI18nTitle: 'Тёмная тема, 16 языков',
    featureI18nBody:
      'Английский, французский, испанский, русский, немецкий и другие. Переключайте тему когда угодно.',
    featureNativeTitle: 'Лёгкий, быстрый, нативный',
    featureNativeBody:
      'Построен на Tauri. Крошечный бинарник, настоящее окно ОС, без слежения, без телеметрии.',
    featureSoonTitle: 'Spotify и Deezer скоро',
    featureSoonBody:
      'Скоро: вставьте ссылку Spotify или Deezer, и приложение найдёт соответствующий трек. Интерфейс готов, движок в разработке.',
    featureOssTitle: 'Открытый исходный код',
    featureOssBody:
      'Лицензия MIT. Весь код на GitHub — читайте, сообщайте об ошибках, предлагайте улучшения.',
    footerCopy: 'Patotube · MIT',
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
      'Windows ve Android için modern, hafif medya indiricisi. YouTube ve SoundCloud. MP4 video veya MP3 ses. Varsayılan koyu tema. 16 dil.',
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
    featureYtTitle: 'YouTube ve SoundCloud',
    featureYtBody:
      "Linkini yapıştır, uygulama gerisini halletsin. Spotify ve Deezer eşleştirmesi yakında.",
    featureFormatsTitle: 'MP4 video veya MP3 ses',
    featureFormatsBody:
      'Türü seç, kaliteyi seç, indir. ffmpeg pakete dahil, ekstra kurulum yok.',
    featureI18nTitle: 'Varsayılan koyu, 16 dil',
    featureI18nBody:
      'İngilizce, Fransızca, İspanyolca, Türkçe, Almanca ve daha fazlası. Temayı istediğin zaman değiştir.',
    featureNativeTitle: 'Hafif, hızlı, yerel',
    featureNativeBody:
      'Tauri üzerine kurulu. Minik bir ikili dosya, gerçek OS penceresi, takip yok, telemetri yok.',
    featureSoonTitle: 'Spotify ve Deezer yakında',
    featureSoonBody:
      'Yakında: bir Spotify veya Deezer linki yapıştırın, uygulama eşleşen şarkıyı bulacak. Arayüz hazır, motor inşa halinde.',
    featureOssTitle: 'Açık kaynak',
    featureOssBody:
      "MIT lisansı. Tüm kod GitHub'da — oku, hata bildir, iyileştirme öner.",
    footerCopy: 'Patotube · MIT',
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
      'Windows और Android के लिए आधुनिक, हल्का मीडिया डाउनलोडर। YouTube और SoundCloud। MP4 वीडियो या MP3 ऑडियो। डिफ़ॉल्ट रूप से डार्क। 16 भाषाएँ।',
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
    featureYtTitle: 'YouTube और SoundCloud',
    featureYtBody:
      'अपना लिंक पेस्ट करें, ऐप बाकी संभालता है। Spotify और Deezer मिलान जल्द आ रहा है।',
    featureFormatsTitle: 'MP4 वीडियो या MP3 ऑडियो',
    featureFormatsBody:
      'प्रकार चुनें, गुणवत्ता चुनें, डाउनलोड करें। ffmpeg बंडल में शामिल, कोई अतिरिक्त इंस्टॉल नहीं।',
    featureI18nTitle: 'डिफ़ॉल्ट डार्क, 16 भाषाएँ',
    featureI18nBody:
      'अंग्रेज़ी, फ़्रेंच, स्पेनिश, हिन्दी, जर्मन, और अधिक। थीम कभी भी बदलें।',
    featureNativeTitle: 'हल्का, तेज़, मूल',
    featureNativeBody:
      'Tauri पर आधारित। छोटी बाइनरी, असली OS विंडो, कोई ट्रैकिंग नहीं, कोई टेलीमेट्री नहीं।',
    featureSoonTitle: 'Spotify और Deezer जल्द आ रहे हैं',
    featureSoonBody:
      'जल्द: Spotify या Deezer लिंक पेस्ट करें, ऐप मेल खाने वाला गाना ढूंढेगा। इंटरफ़ेस तैयार, इंजन निर्माणाधीन।',
    featureOssTitle: 'ओपन सोर्स',
    featureOssBody:
      'MIT लाइसेंस। पूरा कोड GitHub पर है — पढ़ें, बग रिपोर्ट करें, सुधार सुझाएं।',
    footerCopy: 'Patotube · MIT',
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
      'Windows와 Android를 위한 현대적이고 가벼운 미디어 다운로더. YouTube와 SoundCloud. MP4 비디오 또는 MP3 오디오. 기본 다크 모드. 16개 언어.',
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
    featureYtTitle: 'YouTube와 SoundCloud',
    featureYtBody:
      '링크를 붙여넣으면 앱이 알아서 처리합니다. Spotify와 Deezer 매칭 곧 출시 예정.',
    featureFormatsTitle: 'MP4 비디오 또는 MP3 오디오',
    featureFormatsBody:
      '종류를 고르고, 품질을 고르고, 다운로드. ffmpeg 번들 포함, 추가 설치 불필요.',
    featureI18nTitle: '기본 다크, 16개 언어',
    featureI18nBody:
      '영어, 프랑스어, 스페인어, 한국어, 독일어 등. 언제든지 테마 전환.',
    featureNativeTitle: '가볍고, 빠르고, 네이티브',
    featureNativeBody:
      'Tauri 기반. 작은 바이너리, 진짜 OS 창, 추적 없음, 텔레메트리 없음.',
    featureSoonTitle: 'Spotify와 Deezer 곧 출시',
    featureSoonBody:
      '곧 출시: Spotify나 Deezer 링크를 붙여넣으면 앱이 해당 트랙을 찾습니다. 인터페이스는 준비됨, 엔진 구축 중.',
    featureOssTitle: '오픈 소스',
    featureOssBody:
      'MIT 라이선스. 모든 코드는 GitHub에 있습니다 — 읽고, 버그 신고하고, 개선 제안하세요.',
    footerCopy: 'Patotube · MIT',
    footerIssues: 'Issues',
    footerReleases: 'Releases',
    comingSoon: '출시 예정',
  },
};
