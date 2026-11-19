/**
 * ============================================================
 * NIAS Evaluation System v7.0 — app.js (محسّن ومكتمل)
 * المعهد الوطني للعلوم الإدارية — فرع إب
 * ============================================================
 * - إصلاح مشكلة عدم ظهور استمارات التقييم
 * - دعم كامل لـ targetId في النماذج
 * - تحسين التحقق من الأدوار
 * - تحسين معالجة الأخطاء والتشخيص
 * - توحيد الخطوط والألوان مع الترويسة الرسمية
 */

const App = {
  currentForm: null,
  currentTab: 'evaluations',
  currentPage: 1,
  itemsPerPage: 10,
  searchQuery: '',

  theme: {
    colors: {
      greenDark: '#0a7a3d',
      greenDarker: '#065a2c',
      greenPrimary: '#0d4a2e',
      greenLight: '#7cb342',
      gold: '#c8a415',
      goldLight: '#f0d060',
      goldAccent: '#c8940a',
    },
    fonts: {
      heading: "'Cairo', 'Amiri Quran', 'Tajawal', sans-serif",
      body: "'Tajawal', 'Amiri Quran', sans-serif",
      naskh: "'Amiri Quran', 'Noto Naskh Arabic', serif",
    }
  },

  // ===================== نماذج التقييم =====================
  formsData: {
    deputies: {
      id: 'deputies',
      title: 'مقياس تقييم أداء النواب والمراكز',
      subtitle: 'من وجهة نظر القيادة العليا للمعهد 2025-2026',
      icon: '👔',
      color: 'green',
      description: 'تقييم الأداء الوظيفي لنواب ومراكز المعهد من قبل القيادة العليا',
      roles: ['admin'], // سيتم توسيعها في الكود
      targetType: 'user',
      fields: [
        { name: 'targetId', label: 'النائب/المركز المُقيَّم', required: true, type: 'select', source: 'users', filter: { role: ['vice_dean', 'dean', 'head'] } },
        { name: 'appointment_date', label: 'تاريخ التكليف', required: true, type: 'date' },
        { name: 'specialization', label: 'التخصص الدقيق', required: true },
        { name: 'title', label: 'اللقب العلمي', required: true },
        { name: 'location', label: 'مكان الكلية', required: true }
      ],
      extraFields: [
        { name: 'departments', label: 'الأقسام التي يرأسها والمقررات التي يقوم بتدريسها', type: 'textarea', fullWidth: true }
      ],
      indicators: [
        { id: 1, text: 'يحضر اجتماعات المجلس العلمي باستمرار.', max: 5 },
        { id: 2, text: 'يعقد مجلس الكلية بشكل دوري.', max: 5 },
        { id: 3, text: 'ينفذ قرارات مجالس المعهد في وقتها المحدد.', max: 5 },
        { id: 4, text: 'يُطلع رؤساء الأقسام في الكلية والمراكز على موجهات وقرارات ومراسلات قيادة المعهد.', max: 5 },
        { id: 5, text: 'يشارك في إعداد الخطة التشغيلية للكلية ويتابع تنفيذها في سياق تحقيق رؤية ورسالة المعهد.', max: 5 },
        { id: 6, text: 'يتابع تنفيذ الخطة التشغيلية للمعهد.', max: 5 },
        { id: 7, text: 'يشارك في عمليات التخطيط الاستراتيجي في المعهد.', max: 5 },
        { id: 8, text: 'يلتزم بدوامه الرسمي والمكتبي.', max: 5 },
        { id: 9, text: 'تفعيل ضمان جودة البرامج الأكاديمية عبر رؤساء الأقسام العلمية وأعضاء هيئة التدريس ومساعديهم.', max: 5 },
        { id: 10, text: 'يتابع أنشطة الأقسام العلمية كالندوات، السمنارات، اللقاءات المفتوحة، المعارض، الزيارات الميدانية، تبادل الخبرات، مشاريع التخرج.', max: 5 },
        { id: 11, text: 'والإشراف والتقييم على مشاريع التخرج.', max: 5 },
        { id: 12, text: 'يتابع دوام والتزام رؤساء الأقسام العلمية وأعضاء هيئة التدريس ومساعديهم أثناء العمل.', max: 5 },
        { id: 13, text: 'يعقد لقاءات فردية مع رؤساء الأقسام العلمية لمناقشة وضع الأقسام والعمل على تطويرها.', max: 5 },
        { id: 14, text: 'يساهم في تحسين سمعة المعهد التنافسية من خلال تحسين الأداء الأكاديمي والإداري.', max: 5 },
        { id: 15, text: 'ينفذ لقاءات مفتوحة مع الطلبة الدراسين.', max: 5 },
        { id: 16, text: 'يتجسد فيه روح الولاء المؤسسي والعمل بمهنية.', max: 5 },
        { id: 17, text: 'يشارك بتقديم أفكار ومقترحات للمعهد لتحسين عملية القبول والتسجيل.', max: 5 },
        { id: 18, text: 'يمارس عملية الاتصال الرأسي والأفقي بشكل لائق.', max: 5 },
        { id: 19, text: 'يسهم في تحسين الأقسام والمكتبات والقاعات والمعامل بشكل دوري.', max: 5 },
        { id: 20, text: 'يوجه البحث العلمي في المعهد نحو الأولويات الوطنية واحتياجات التنمية الشاملة.', max: 5 },
        { id: 21, text: 'يتابع تنفيذ خطط وحدة الجودة والتطوير الأكاديمي.', max: 5 },
        { id: 22, text: 'يشارك في وضع خطة عمل مع رؤساء الأقسام العلمية للتسويق للفئات المستهدفة من مخرجات التعليم الثانوي.', max: 5 }
      ],
      signatures: [
        { title: 'رأي نائب العميد للشئون الأكاديمية' },
        { title: 'رأي عميد المعهد' }
      ],
      finalSignature: 'الرأي النهائي (عميد المعهد)'
    },

    student_eval: {
      id: 'student_eval',
      title: 'استمارة تقييم الطالب لأداء عضو هيئة التدريس',
      subtitle: '2025-2026',
      icon: '🎓',
      color: 'blue',
      description: 'تقييم الطلاب لأداء أعضاء هيئة التدريس في العملية التعليمية',
      roles: ['admin', 'student', 'evaluator'], // evaluator سيتوسع
      targetType: 'user',
      intro: 'حرصاً من المعهد على تحسين فاعلية التدريس كمتطلب أساسي لضمان جودة برامجه وتطوير فاعلية تعلمك، نضع بين يديك استبانة تقييم مدرسك في هذا المقرر تتكون من (22) عبارة تمثل جوانب الأداء الأساسية للمدرس وتم تحديد العلامات المقررة لها. يرجى منك تحديد العلامة المستحقة له بحسب مستوى موافقتك عن فاعلية أدائه من العلامة المقدرة.',
      fields: [
        { name: 'student_name', label: 'اسم الطالب', required: true },
        { name: 'targetId', label: 'عضو هيئة التدريس المُقيَّم', required: true, type: 'select', source: 'users', filter: { role: ['faculty'] } },
        { name: 'course', label: 'المقرر', required: true },
        { name: 'semester', label: 'الفصل الدراسي', required: true },
        { name: 'date', label: 'التاريخ', required: true, type: 'date' }
      ],
      indicators: [
        { id: 1, text: 'يلتزم بمواعيد المحاضرات.', max: 5 },
        { id: 2, text: 'يعد نفسه للمحاضرات.', max: 5 },
        { id: 3, text: 'يهتم عضو هيئة التدريس بمظهره العام.', max: 5 },
        { id: 4, text: 'يستخدم الوسائط التعليمية بفاعلية.', max: 5 },
        { id: 5, text: 'يتفهم عضو هيئة التدريس مشاكل الطلبة.', max: 4 },
        { id: 6, text: 'يتعامل عضو هيئة التدريس بحيادية مع الطلبة.', max: 5 },
        { id: 7, text: 'يوجه الطلاب لمراجع أخرى للمادة الدراسية.', max: 4 },
        { id: 8, text: 'عضو هيئة التدريس متمكن علمياً من المادة التي يدرسها.', max: 5 },
        { id: 9, text: 'طريقة عرضه للمعلومات واضحة ومترابطة ومنظمة.', max: 4 },
        { id: 10, text: 'يربط عضو هيئة التدريس المحاضرة الجديدة بالمحاضرة السابقة.', max: 5 },
        { id: 11, text: 'يتحدث في المحاضرة بلغة رسمية.', max: 4 },
        { id: 12, text: 'يوزع الخطة التدريسية للمقرر للفصل الدراسي في بداية الفصل موزعة على الأسابيع الدراسية.', max: 3 },
        { id: 13, text: 'يتقيد بالزمن المحدد للمحاضرة.', max: 4 },
        { id: 14, text: 'صوت عضو هيئة التدريس مسموع وواضح.', max: 3 },
        { id: 15, text: 'يشجع الطلبة على المناقشة وطرح الأسئلة.', max: 4 },
        { id: 16, text: 'يحفز الطالب على التفاعل الإيجابي في المحاضرة.', max: 4 },
        { id: 17, text: 'يناقش نتائج أوراق الاختبارات وتكاليف الطلبة.', max: 4 },
        { id: 18, text: 'تراعي أسئلة الامتحانات مستويات التفكير.', max: 4 },
        { id: 19, text: 'يتناسب زمن الامتحانات مع الزمن المخصص لها.', max: 4 },
        { id: 20, text: 'يسمح للطلبة بمراجعة نتائج الاختبارات.', max: 4 },
        { id: 21, text: 'يسجل عضو هيئة التدريس أسماء الحضور والغياب بانتظام.', max: 4 },
        { id: 22, text: 'يعرف الطلبة بالأهداف التعليمية في المادة العلمية.', max: 3 }
      ],
      signatures: [
        { title: 'رأي رئيس القسم' },
        { title: 'رأي عميد الكلية' },
        { title: 'رأي نائب العميد للشئون الأكاديمية' }
      ],
      finalSignature: 'الرأي النهائي (عميد المعهد)'
    },

    faculty_self: {
      id: 'faculty_self',
      title: 'مقياس تقييم أداء أعضاء هيئة التدريس لمهامهم العلمية',
      subtitle: 'من وجهة نظر رؤساء الأقسام العلمية 2025-2026',
      icon: '📚',
      color: 'gold',
      description: 'تقييم أداء أعضاء هيئة التدريس من قبل رؤساء الأقسام العلمية',
      roles: ['admin', 'head', 'dean', 'vice_dean'], // أدوار مباشرة
      targetType: 'user',
      intro: 'يمثل تقييم الأداء الوظيفي بشقيه الأكاديمي والإداري من أهداف وأنشطة الخطة الاستراتيجية للمعهد؛ لما له من أهمية قصوى في إعطاء التغذية الراجعة الموضوعية لقيادة المعهد عن طبيعة مستوى الأداء في المعهد، والذي يسهم بشكل مباشر في صناعة القرار الرامي إلى تحسين العملية التعليمية في سياق رؤية المعهد ورسالته.',
      fields: [
        { name: 'targetId', label: 'عضو هيئة التدريس المُقيَّم', required: true, type: 'select', source: 'users', filter: { role: ['faculty'] } },
        { name: 'college', label: 'الكلية', required: true },
        { name: 'department', label: 'القسم العلمي', required: true },
        { name: 'specialization', label: 'التخصص الدقيق', required: true },
        { name: 'title', label: 'اللقب العلمي', required: true },
        { name: 'experience', label: 'فترة عمله في المعهد', required: true }
      ],
      extraFields: [
        { name: 'courses', label: 'المقررات التي يقوم بتدريسها', type: 'textarea', fullWidth: true }
      ],
      indicators: [
        { id: 1, text: 'يحضر اجتماعات مجلس القسم باستمرار ويتفاعل معها.', max: 4 },
        { id: 2, text: 'ينفذ قرارات مجالس المعهد والكلية والقسم بفاعلية.', max: 4 },
        { id: 3, text: 'يلتزم بمظهره الخارجي اللائق.', max: 4 },
        { id: 4, text: 'يلتزم بإدارة الوقت بكفاءة بما يعزز التزامه بمواعيده التدريسية والمكتبية.', max: 4 },
        { id: 5, text: 'يطلع ويطبق وثيقة توصيف البرامج الأكاديمية ومحتواها كاملاً بما يجعله قادراً على تطبيقها.', max: 4 },
        { id: 6, text: 'يعتمد على توصيف المقررات الدراسية التي يقوم بتدريسها.', max: 4 },
        { id: 7, text: 'يطلع الطلبة الدراسين على مخرجات تعلم المقرر وتوزيع مفرداته بداية الفصل الدراسي.', max: 4 },
        { id: 8, text: 'يستخدم استراتيجيات التدريس والتقييم بناء على مخرجات التعلم.', max: 4 },
        { id: 9, text: 'يشارك في برامج التنمية المهنية التي ينفذها المعهد.', max: 4 },
        { id: 10, text: 'يسهم في تحقيق الخطط التشغيلية للمعهد والقسم.', max: 4 },
        { id: 11, text: 'يشارك في أنشطة ضمان الجودة والاعتماد الأكاديمي.', max: 4 },
        { id: 12, text: 'ينفذ الأنشطة المصاحبة للمقررات الدراسية.', max: 4 },
        { id: 13, text: 'ينفذ خطة عمل القسم وأنشطته كالندوات، السمنارات، اللقاءات المفتوحة، المعارض، الزيارات الميدانية، تبادل الخبرات، مشاريع التخرج.', max: 4 },
        { id: 14, text: 'يتابع حضور الطلبة الدراسين في المحاضرات والتطبيقات العملية والتدريبات الميدانية.', max: 4 },
        { id: 15, text: 'يتابع جداول توزيع الطلبة الدراسين على المعامل ويتأكد من ذلك.', max: 4 },
        { id: 16, text: 'التواصل الإيجابي مع الطلبة.', max: 4 },
        { id: 17, text: 'يتجسد فيه روح الولاء المؤسسي والعمل بمهنية.', max: 4 },
        { id: 18, text: 'يقدم أفكار ومقترحات للمعهد لتحسين عملية القبول والتسجيل.', max: 4 },
        { id: 19, text: 'يتعامل مع قيادة المعهد، والقسم، وزملائه، والطلبة باحترام ومهنية.', max: 4 },
        { id: 20, text: 'قادراً على توصيل المعلومات للطلبة ببساطة ووضوح.', max: 4 },
        { id: 21, text: 'يسهم في تحسين سمعة المعهد من خلال المشاركات، ونشر الأبحاث العلمية باسمه.', max: 4 },
        { id: 22, text: 'يحبب الطلبة في تخصصاتهم العلمية في سياق سمعة المعهد التنافسية.', max: 4 },
        { id: 23, text: 'يظهر الولاء المؤسسي للمعهد من خلال الممارسات المهنية مع الطلبة وأولياء الأمور.', max: 4 },
        { id: 24, text: 'ينجز مع الطلبة مشاريع تخرجهم بمنهجية علمية رصينة.', max: 4 },
        { id: 25, text: 'يصمم بنك أسئلة للمقررات الدراسية وفقاً لشروط ومعايير بناء الاختبارات.', max: 4 }
      ],
      signatures: [
        { title: 'رأي رئيس القسم' },
        { title: 'رأي عميد الكلية' },
        { title: 'رأي نائب العميد للشئون الأكاديمية' }
      ],
      finalSignature: 'الرأي النهائي (عميد المعهد)'
    }
  },

  // ===================== التهيئة =====================
  async init() {
    try {
      await Auth.init();
      if (!(await Auth.requireAuth())) return;
      
      console.log('[NIAS] ✅ Auth.user:', Auth.user);
      
      await this.renderDashboard();
      this.setupEventListeners();
      this.applyTheme();
      await DB.addLog(Auth.user.id, 'app_init', 'تهيئة التطبيق');
    } catch (err) {
      console.error('[NIAS] ❌ App init failed:', err);
      this.showToast('فشل في تهيئة التطبيق', 'error');
    }
  },

  // ===================== لوحة التحكم =====================
  async renderDashboard() {
    const container = document.getElementById('dashboard-view');
    if (!container) {
      console.error('[NIAS] ❌ عنصر dashboard-view غير موجود');
      return;
    }

    console.log('[NIAS] 🔍 Auth.user:', Auth.user);
    console.log('[NIAS] 🔍 Role:', Auth.user?.role);

    const isAdmin = Auth.hasRole('admin');
    let adminSection = '';

    if (isAdmin) {
      const stats = await this.getStats();
      adminSection = `<div class="admin-panel animate-fade-in">
        <div class="section-title"><div class="icon">⚙️</div><span>لوحة تحكم المسؤول</span></div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value">${stats.totalEvals}</div><div class="stat-label">إجمالي التقييمات</div></div>
          <div class="stat-card"><div class="stat-value">${stats.totalUsers}</div><div class="stat-label">المستخدمين</div></div>
          <div class="stat-card"><div class="stat-value">${stats.todayEvals}</div><div class="stat-label">تقييمات اليوم</div></div>
          <div class="stat-card"><div class="stat-value">${stats.avgScore}</div><div class="stat-label">متوسط الدرجات</div></div>
        </div>
        <div class="admin-tabs">
          <button class="admin-tab ${this.currentTab === 'evaluations' ? 'active' : ''}" onclick="App.switchTab('evaluations', this)">📊 التقييمات</button>
          <button class="admin-tab ${this.currentTab === 'users' ? 'active' : ''}" onclick="App.switchTab('users', this)">👥 المستخدمين</button>
          <button class="admin-tab ${this.currentTab === 'logs' ? 'active' : ''}" onclick="App.switchTab('logs', this)">📋 السجلات</button>
          <button class="admin-tab ${this.currentTab === 'backup' ? 'active' : ''}" onclick="App.switchTab('backup', this)">💾 نسخ احتياطي</button>
        </div>
        <div id="admin-content">${await this.renderAdminContent()}</div>
      </div>`;
    }

    // عرض النماذج المسموحة فقط
    const cards = Object.values(this.formsData).map(form => {
      const canAccess = Auth.checkRole(form.roles);
      console.log(`[NIAS] 📋 نموذج ${form.id} - مسموح: ${canAccess}`);
      if (!canAccess) return '';
      
      return `<div class="eval-card animate-fade-in" onclick="App.openForm('${form.id}')">
        <div class="card-header">
          <div class="card-icon ${form.color}">${form.icon}</div>
          <div><div class="card-title">${form.title}</div><div class="card-desc">${form.description}</div></div>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="meta-item">📋 ${form.indicators.length} مؤشر</span>
            <span class="meta-item">📊 100 درجة</span>
            <span class="meta-item">📅 2025-2026</span>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-success" style="width:100%"><span>بدء التقييم</span><span>←</span></button>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `<div class="hero-section">
      <div class="hero-badge">العام الأكاديمي 2025-2026</div>
      <h1 class="hero-title">نظام التقييم الإلكتروني</h1>
      <p class="hero-subtitle">مركز التخطيط والتطوير وضمان الجودة - المعهد الوطني للعلوم الإدارية</p>
    </div>
    ${adminSection}
    <div class="cards-grid">${cards || '<p style="text-align:center;color:var(--text-muted)">لا توجد نماذج متاحة لدورك</p>'}</div>`;

    this.renderUserChip();
  },

  renderUserChip() {
    const chip = document.getElementById('user-chip');
    const avatar = document.getElementById('user-avatar');
    const nameLabel = document.getElementById('user-name-label');
    const roleLabel = document.getElementById('user-role-label');
    if (!chip || !Auth.user) return;

    const roleInfo = Auth.getRoleInfo(Auth.user.role);
    const initials = Auth.user.name.split(' ').map(n => n[0]).join('').substring(0, 2);

    if (nameLabel) nameLabel.textContent = Auth.user.name;
    if (roleLabel) roleLabel.textContent = roleInfo.label;
    if (avatar) avatar.textContent = initials;
    chip.style.display = 'flex';
  },

  async getStats() {
    try {
      const evals = await DB.getEvaluationsScoped();
      const users = await DB.getUsersScoped();
      const today = new Date().toDateString();
      const todayEvals = evals.filter(e => new Date(e.createdAt).toDateString() === today).length;
      const avgScore = evals.length > 0
        ? (evals.reduce((a, b) => a + (parseFloat(b.total) || 0), 0) / evals.length).toFixed(1)
        : '0.0';
      return { totalEvals: evals.length, totalUsers: users.length, todayEvals, avgScore };
    } catch (err) {
      console.error('[NIAS] getStats error:', err);
      return { totalEvals: 0, totalUsers: 0, todayEvals: 0, avgScore: '0.0' };
    }
  },

  async switchTab(tab, btn) {
    this.currentTab = tab;
    this.currentPage = 1;
    const contentDiv = document.getElementById('admin-content');
    if (contentDiv) {
      contentDiv.innerHTML = '<div style="text-align:center;padding:2rem">⏳ جاري التحميل...</div>';
      contentDiv.innerHTML = await this.renderAdminContent();
    }
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
  },

  async renderAdminContent() {
    try {
      if (this.currentTab === 'evaluations') return await this.renderEvaluationsTab();
      if (this.currentTab === 'users') return await this.renderUsersTab();
      if (this.currentTab === 'logs') return await this.renderLogsTab();
      if (this.currentTab === 'backup') return await this.renderBackupTab();
      return '';
    } catch (err) {
      console.error('[NIAS] renderAdminContent error:', err);
      return `<div class="empty-state"><div class="icon">⚠️</div><h4>حدث خطأ في التحميل</h4></div>`;
    }
  },

  // ===================== تبويب التقييمات =====================
  async renderEvaluationsTab() {
    const evals = await DB.getEvaluationsScoped();
    if (!evals.length) return `<div class="empty-state"><div class="icon">📊</div><h4>لا توجد تقييمات</h4></div>`;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const paginated = evals.slice(start, start + this.itemsPerPage);
    const totalPages = Math.ceil(evals.length / this.itemsPerPage);

    const rows = paginated.map(e => {
      const grade = this.getGrade(parseFloat(e.total) || 0);
      const formTitle = (this.formsData[e.formType]?.title || e.formType).substring(0, 30);
      const dateStr = e.createdAt ? new Date(e.createdAt).toLocaleDateString('ar-SA') : '-';
      return `<tr>
        <td>${formTitle}...</td>
        <td>${e.evaluatorName || '-'}</td>
        <td>${dateStr}</td>
        <td><strong>${e.total || 0}</strong></td>
        <td><span class="badge-grade ${grade.cls}">${grade.label}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="App.viewEval('${e.id}')" title="عرض">👁️</button>
          ${Auth.hasRole('admin') ? `<button class="btn btn-ghost btn-sm" style="color:#dc2626" onclick="App.deleteEval('${e.id}')" title="حذف">🗑️</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    const pagination = totalPages > 1 ? `<div class="pagination">
      ${Array.from({ length: totalPages }, (_, i) => `<button class="btn btn-sm ${i + 1 === this.currentPage ? 'btn-primary' : 'btn-ghost'}" onclick="App.goToPage(${i + 1})">${i + 1}</button>`).join('')}
    </div>` : '';

    return `<div class="search-box"><span class="search-icon">🔍</span>
      <input type="text" placeholder="البحث في التقييمات..." oninput="App.filterTable(this.value)"></div>
    <div class="table-wrap"><table class="data-table" id="evals-table">
      <thead><tr><th>النوع</th><th>المقيّم</th><th>التاريخ</th><th>المجموع</th><th>التقدير</th><th>إجراءات</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    ${pagination}`;
  },

  goToPage(page) {
    this.currentPage = page;
    this.switchTab('evaluations', document.querySelector('.admin-tab.active'));
  },

  filterTable(query) {
    const rows = document.querySelectorAll('#evals-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(r => r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none');
  },

  // ===================== تبويب المستخدمين =====================
  async renderUsersTab() {
    const users = await DB.getUsersScoped();
    return `<div style="display:flex;justify-content:space-between;margin-bottom:1rem;align-items:center">
      <h3 style="margin:0">إدارة المستخدمين</h3>
      <button class="btn btn-success btn-sm" onclick="App.showAddUserModal()">➕ مستخدم جديد</button>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>القسم</th><th>الفرع</th><th>الحالة</th><th>آخر دخول</th><th>إجراءات</th></tr></thead>
      <tbody>${users.map(u => {
        const roleInfo = Auth.getRoleInfo(u.role);
        const isActive = u.isActive !== false;
        const isSelf = u.id === Auth.user.id;
        const isSystemAdmin = u.isSystemAdmin;
        return `<tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.username}</td>
          <td><span class="badge-role badge-${u.role}">${roleInfo.label}</span></td>
          <td>${u.department || '-'}</td>
            <td>${Auth.user.role === 'admin'
              ? `<select class="form-control" style="min-width:110px;font-size:12px;padding:4px;${u.branch ? '' : 'border-color:#e8a820;'}" onchange="App.setUserBranch('${u.id}', this.value)">
                  <option value="">— بلا فرع —</option>
                  ${DB.BRANCHES.map(b => `<option value="${b}"${b === u.branch ? ' selected' : ''}>${b.replace('المعهد الوطني للعلوم الإدارية - ', '')}</option>`).join('')}
                </select>`
              : (u.branch ? u.branch.replace('المعهد الوطني للعلوم الإدارية - ', '') : '—')}</td>
          <td><span class="badge-grade ${isActive ? 'grade-good' : 'grade-weak'}">${isActive ? 'نشط' : 'معطل'}</span></td>
          <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-SA') : '—'}</td>
          <td>
            ${!isSelf && !isSystemAdmin ? `
              <button class="btn btn-ghost btn-sm" onclick="App.toggleUserActive('${u.id}')" title="${isActive ? 'تعطيل' : 'تفعيل'}">${isActive ? '🔴' : '🟢'}</button>
              <button class="btn btn-ghost btn-sm" style="color:#dc2626" onclick="App.deleteUser('${u.id}')" title="حذف">🗑️</button>
            ` : '<span style="color:var(--text-muted);font-size:0.8rem">غير متاح</span>'}
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  },

  // ===================== تبويب السجلات =====================
  async renderLogsTab() {
    const logs = await DB.getLogs(50);
    if (!logs.length) return `<div class="empty-state"><div class="icon">📋</div><h4>لا توجد سجلات</h4></div>`;

    const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId))];
    const userMap = {};
    await Promise.all(userIds.map(async id => {
      const u = await DB.findUserById(id);
      if (u) userMap[id] = u.name;
    }));

    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الوصف</th></tr></thead>
      <tbody>${logs.map(l => `<tr>
        <td style="white-space:nowrap;font-size:0.85rem">${new Date(l.timestamp).toLocaleString('ar-SA')}</td>
        <td>${userMap[l.userId] || l.userId || '—'}</td>
        <td><span class="badge-role badge-admin">${l.action}</span></td>
        <td style="font-size:0.9rem">${l.description}</td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  async renderBackupTab() {
    const backups = await DB.getBackups(5);
    const backupRows = backups.length ? backups.map(b => `<tr>
      <td>${new Date(b.timestamp).toLocaleString('ar-SA')}</td>
      <td>${(b.size / 1024).toFixed(1)} KB</td>
      <td>${b.note || '-'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="App.restoreBackup(${b.id})">↩️ استعادة</button></td>
    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center">لا توجد نسخ احتياطية</td></tr>';

    return `<div style="display:grid;gap:1rem">
      <div class="info-section">
        <div class="section-title"><div class="icon">💾</div><span>نسخ احتياطي للبيانات</span></div>
        <div style="display:flex;gap:0.7rem;flex-wrap:wrap;margin-bottom:1rem">
          <button class="btn btn-success" onclick="App.exportData()">📥 تصدير البيانات</button>
          <button class="btn btn-primary" onclick="App.importData()">📤 استيراد البيانات</button>
          <button class="btn btn-warning" onclick="App.createBackup()">💾 إنشاء نسخة احتياطية</button>
          <button class="btn btn-danger" onclick="App.clearAllData()">🗑️ مسح جميع البيانات</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>التاريخ</th><th>الحجم</th><th>ملاحظة</th><th>إجراءات</th></tr></thead>
            <tbody>${backupRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  // ===================== إدارة المستخدمين =====================
  showAddUserModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal" style="max-width:500px; max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-head">
        <h3 style="font-family: ${this.theme.fonts.heading};">إضافة مستخدم جديد</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="flex:1; overflow-y:auto; display:grid; gap:1rem; padding:1.5rem;">
        <div class="form-group"><label>الاسم الكامل *</label><input type="text" id="new-user-name" class="form-control" placeholder="مثال: د. أحمد العلي"></div>
        <div class="form-group"><label>اسم المستخدم *</label><input type="text" id="new-user-username" class="form-control" placeholder="مثال: ahmad.ali"></div>
        <div class="form-group"><label>كلمة المرور *</label><input type="password" id="new-user-password" class="form-control" placeholder="6 أحرف على الأقل"></div>
        <div class="form-group"><label>الدور *</label>
          <select id="new-user-role" class="form-control">
            <option value="vice_dean">نائب العميد</option>
            <option value="dean">عميد الكلية</option>
            <option value="head">رئيس القسم</option>
            <option value="faculty">عضو هيئة تدريس</option>
            <option value="student">طالب</option>
            <option value="admin">مسؤول النظام</option>
          </select>
        </div>
        <div class="form-group"><label>القسم / الكلية</label><input type="text" id="new-user-dept" class="form-control" placeholder="مثال: قسم الإدارة الصحية"></div>
        <div class="form-group"><label>الفرع *</label>
          <select id="new-user-branch" class="form-control">
            <option value="">اختر الفرع</option>
            ${DB.BRANCHES.map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="new-user-email" class="form-control"></div>
        <div class="form-group"><label>رقم الهاتف</label><input type="tel" id="new-user-phone" class="form-control"></div>
      </div>
      <div class="modal-foot" style="flex-shrink:0; padding:1rem 1.5rem; background:var(--surface-hover); border-top:1px solid var(--border); display:flex; gap:0.75rem; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
        <button class="btn btn-success" id="confirm-add-user" style="min-width:120px; background: linear-gradient(135deg, ${this.theme.colors.greenDark}, ${this.theme.colors.greenDarker});">➕ إضافة</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    (async () => {
      try {
        if (Auth.user && Auth.user.role !== 'admin') {
          const me = await DB.findUserById(Auth.user.id);
          const sel = document.getElementById('new-user-branch');
          if (sel && me && me.branch) { sel.value = me.branch; sel.disabled = true; }
        }
      } catch (e) {}
    })();

    document.getElementById('confirm-add-user').addEventListener('click', async () => {

      const name = document.getElementById('new-user-name').value.trim();
      const username = document.getElementById('new-user-username').value.trim();
      const password = document.getElementById('new-user-password').value;
      const role = document.getElementById('new-user-role').value;
      const dept = document.getElementById('new-user-dept').value.trim();
      const branch = document.getElementById('new-user-branch').value;
      const email = document.getElementById('new-user-email').value.trim();
      const phone = document.getElementById('new-user-phone').value.trim();

      if (!name || !username || !password || !branch) {
        this.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      try {
        await DB.addUserAsync({ username, password, name, role, department: dept, branch, email, phone });
        await DB.addLog(Auth.user.id, 'create_user', `إنشاء مستخدم ${name}`);
        overlay.remove();
        await this.switchTab('users', document.querySelector('.admin-tab:nth-child(2)'));
        this.showToast('تم إضافة المستخدم بنجاح', 'success');
      } catch (err) {
        this.showToast(err.message || 'فشل في إضافة المستخدم', 'error');
      }
    });
  },

  async setUserBranch(id, branch) {
    try {
      await DB.updateUser(id, { branch });
      await DB.addLog(Auth.user.id, 'update_user', `تغيير فرع المستخدم ${id}`);
      this.showToast('تم تحديث الفرع', 'success');
    } catch (err) {
      this.showToast(err.message || 'فشل تحديث الفرع', 'error');
    }
  },

  async toggleUserActive(id) {
    try {
      const user = await DB.toggleUserActive(id);
      if (user) {
        this.showToast(`تم ${user.isActive ? 'تفعيل' : 'تعطيل'} المستخدم`, 'success');
        await this.switchTab('users', document.querySelector('.admin-tab:nth-child(2)'));
      }
    } catch (err) {
      this.showToast(err.message || 'فشل في تحديث الحالة', 'error');
    }
  },

  async deleteUser(id) {
    this.confirm('حذف مستخدم', 'هل أنت متأكد من حذف هذا المستخدم؟ لن يمكن الحذف إذا كان له تقييمات.', async () => {
      try {
        await DB.deleteUser(id);
        await DB.addLog(Auth.user.id, 'delete_user', 'حذف مستخدم');
        await this.switchTab('users', document.querySelector('.admin-tab:nth-child(2)'));
        this.showToast('تم حذف المستخدم', 'success');
      } catch (err) {
        this.showToast(err.message || 'فشل في حذف المستخدم', 'error');
      }
    });
  },

  async deleteEval(id) {
    this.confirm('حذف تقييم', 'هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع.', async () => {
      await DB.deleteEvaluation(id);
      await DB.addLog(Auth.user.id, 'delete_eval', 'حذف تقييم');
      await this.switchTab('evaluations', document.querySelector('.admin-tab:nth-child(1)'));
      this.showToast('تم حذف التقييم', 'success');
    });
  },

  async viewEval(id) {
    const ev = await DB.getEvaluationById(id);
    if (!ev) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal" style="max-width:700px;max-height:80vh;overflow:auto">
      <div class="modal-head"><h3>تفاصيل التقييم</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body"><pre style="direction:rtl;text-align:right;white-space:pre-wrap;font-family:${this.theme.fonts.body};font-size:0.9rem;line-height:1.8">${JSON.stringify(ev, null, 2)}</pre></div>
    </div>`;
    document.body.appendChild(overlay);
  },

  async createBackup() {
    try {
      await DB.createBackup();
      this.showToast('تم إنشاء نسخة احتياطية', 'success');
      await this.switchTab('backup', document.querySelector('.admin-tab:nth-child(4)'));
    } catch (err) {
      this.showToast('فشل في إنشاء النسخة الاحتياطية', 'error');
    }
  },

  async restoreBackup(backupId) {
    this.confirm('استعادة نسخة احتياطية', 'سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟', async () => {
      try {
        await DB.restoreBackup(backupId);
        this.showToast('تم استعادة النسخة الاحتياطية', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        this.showToast('فشل في الاستعادة', 'error');
      }
    });
  },

  async exportData() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nias-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      this.showToast('تم تصدير البيانات بنجاح', 'success');
    } catch (err) {
      this.showToast('فشل في التصدير', 'error');
    }
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (!data.users || !Array.isArray(data.users)) throw new Error('ملف غير صالح');
          await DB.importAll(data);
          this.showToast('تم استيراد البيانات بنجاح', 'success');
          setTimeout(() => location.reload(), 1000);
        } catch (err) {
          this.showToast(err.message || 'ملف غير صالح', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  clearAllData() {
    this.confirm('مسح جميع البيانات', 'تحذير شديد: سيتم مسح جميع البيانات بشكل دائم وإعادة تهيئة النظام!', async () => {
      await DB.clearAll();
      this.showToast('تم مسح جميع البيانات', 'warning');
      setTimeout(() => location.reload(), 1500);
    });
  },

  // ===================== فتح نموذج التقييم =====================
  openForm(formId) {
    const form = this.formsData[formId];
    if (!form) return;

    if (!Auth.checkRole(form.roles)) {
      this.showToast('ليس لديك صلاحية للوصول إلى هذا النموذج', 'error');
      return;
    }

    this.currentForm = formId;
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('form-view').classList.add('active');
    this.renderForm(form);
    window.scrollTo(0, 0);
  },

  // ===================== عرض النموذج =====================
  async renderForm(form) {
    const container = document.getElementById('form-container');
    if (!container) return;

    // بناء الحقول مع دعم select
    const fieldsHtml = await Promise.all(form.fields.map(async f => {
      if (f.type === 'select' && f.source === 'users') {
        let users = await DB.getUsersScoped();
        if (f.filter?.role) {
          users = users.filter(u => f.filter.role.includes(u.role));
        }
        const options = users.map(u => `<option value="${u.id}">${u.name} (${Auth.getRoleInfo(u.role).label})</option>`).join('');
        return `<div class="form-group">
          <label style="font-family: ${this.theme.fonts.heading};">${f.label} ${f.required ? '<span class="required">*</span>' : ''}</label>
          <select class="form-control" name="${f.name}" ${f.required ? 'required' : ''} style="font-family: ${this.theme.fonts.body};">
            <option value="">-- اختر --</option>
            ${options}
          </select>
        </div>`;
      }
      return `<div class="form-group">
        <label style="font-family: ${this.theme.fonts.heading};">${f.label} ${f.required ? '<span class="required">*</span>' : ''}</label>
        <input type="${f.type || 'text'}" class="form-control" name="${f.name}" placeholder="أدخل ${f.label}" ${f.required ? 'required' : ''} style="font-family: ${this.theme.fonts.body};">
      </div>`;
    }));

    const extraFieldsHtml = form.extraFields ? form.extraFields.map(f => `
      <div class="form-group" ${f.fullWidth ? 'style="grid-column: 1/-1;"' : ''}>
        <label style="font-family: ${this.theme.fonts.heading};">${f.label}</label>
        <textarea class="form-control" name="${f.name}" rows="3" style="font-family: ${this.theme.fonts.body};"></textarea>
      </div>`).join('') : '';

    const indicatorsHtml = form.indicators.map(ind => `
      <tr data-indicator-id="${ind.id}">
        <td style="font-family: ${this.theme.fonts.body};">${ind.id}</td>
        <td style="text-align: right; font-family: ${this.theme.fonts.body};">${ind.text}</td>
        <td style="font-family: ${this.theme.fonts.body};">${ind.max}</td>
        <td><input type="number" class="score-input" data-max="${ind.max}" min="0" max="${ind.max}" value="0" oninput="App.calculateScore(this)" style="font-family: ${this.theme.fonts.body};"></td>
        <td><input type="text" class="note-input" placeholder="ملاحظة..." style="font-family: ${this.theme.fonts.body};"></td>
      </tr>`).join('');

    const signaturesHtml = form.signatures.map(sig => `
      <div class="signature-box"><div class="title" style="font-family: ${this.theme.fonts.heading};">${sig.title}</div><div class="line"></div></div>`).join('');

    container.innerHTML = `
      <div class="page-header">
        <h2 style="font-family: ${this.theme.fonts.heading}; color: ${this.theme.colors.greenPrimary};">${form.title}</h2>
        <p style="font-family: ${this.theme.fonts.body}; color: ${this.theme.colors.goldAccent};">${form.subtitle}</p>
      </div>
      ${form.intro ? `<div class="info-section" style="background: linear-gradient(135deg, rgba(10,122,61,0.08), rgba(200,148,10,0.05)); border-color: rgba(10,122,61,0.2);">
        <div style="white-space: pre-line; line-height: 2; color: #0d4a2e; font-size: 0.95rem; font-family: ${this.theme.fonts.body};">${form.intro}</div>
      </div>` : ''}
      <div class="info-section">
        <div class="section-title"><div class="icon">📝</div><span style="font-family: ${this.theme.fonts.heading};">البيانات الأساسية</span></div>
        <div class="form-grid">${fieldsHtml.join('')}${extraFieldsHtml}</div>
      </div>
      <div class="stats-row no-print">
        <div class="stat-card"><div class="stat-value" id="total-score" style="font-family: ${this.theme.fonts.heading}; color: ${this.theme.colors.greenPrimary};">0</div><div class="stat-label">المجموع الكلي</div></div>
        <div class="stat-card"><div class="stat-value" id="grade-display" style="font-family: ${this.theme.fonts.heading}; color: ${this.theme.colors.goldAccent};">-</div><div class="stat-label">التقدير العام</div></div>
        <div class="stat-card"><div class="stat-value" id="progress-percent" style="font-family: ${this.theme.fonts.heading};">0%</div><div class="stat-label">نسبة الإنجاز</div></div>
      </div>
      <div class="progress-container no-print"><div class="progress-bar" id="progress-bar" style="width: 0%; background: linear-gradient(90deg, ${this.theme.colors.greenDark}, ${this.theme.colors.gold});"></div></div>
      <div class="table-section">
        <div class="section-title"><div class="icon">📊</div><span style="font-family: ${this.theme.fonts.heading};">مؤشرات الأداء</span></div>
        <table class="eval-table">
          <thead><tr>
            <th style="font-family: ${this.theme.fonts.heading};">م</th>
            <th style="font-family: ${this.theme.fonts.heading};">مؤشرات الأداء</th>
            <th style="font-family: ${this.theme.fonts.heading};">الدرجة المفترضة</th>
            <th style="font-family: ${this.theme.fonts.heading};">الدرجة المستحقة</th>
            <th style="font-family: ${this.theme.fonts.heading};">ملاحظات</th>
          </tr></thead>
          <tbody>${indicatorsHtml}
            <tr class="total-row">
              <td colspan="2" style="text-align: center; font-size: 1.2rem; font-family: ${this.theme.fonts.heading};">الإجمالي</td>
              <td style="font-family: ${this.theme.fonts.body};">100</td>
              <td id="total-cell" style="font-size: 1.3rem; color: ${this.theme.colors.greenPrimary}; font-family: ${this.theme.fonts.heading};">0</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grade-section">
        <div class="section-title"><div class="icon">🏆</div><span style="font-family: ${this.theme.fonts.heading};">التقدير العام</span></div>
        <table class="grade-table">
          <thead><tr>
            <th style="font-family: ${this.theme.fonts.heading};">ممتاز</th>
            <th style="font-family: ${this.theme.fonts.heading};">جيد جداً</th>
            <th style="font-family: ${this.theme.fonts.heading};">جيد</th>
            <th style="font-family: ${this.theme.fonts.heading};">مقبول</th>
            <th style="font-family: ${this.theme.fonts.heading};">ضعيف</th>
          </tr></thead>
          <tbody>
            <tr><td style="font-family: ${this.theme.fonts.body};">90 فأكثر</td><td style="font-family: ${this.theme.fonts.body};">89-80</td><td style="font-family: ${this.theme.fonts.body};">79-70</td><td style="font-family: ${this.theme.fonts.body};">69-60</td><td style="font-family: ${this.theme.fonts.body};">أقل من 60</td></tr>
            <tr>
              <td class="grade-cell" data-grade="excellent" data-min="90" data-max="100"></td>
              <td class="grade-cell" data-grade="verygood" data-min="80" data-max="89"></td>
              <td class="grade-cell" data-grade="good" data-min="70" data-max="79"></td>
              <td class="grade-cell" data-grade="acceptable" data-min="60" data-max="69"></td>
              <td class="grade-cell" data-grade="weak" data-min="0" data-max="59"></td>
            </tr>
          </tbody>
        </table>
        <div class="result-display">
          <div class="result-item"><div class="label" style="font-family: ${this.theme.fonts.body};">المجموع الكلي</div><div class="value" id="result-total" style="font-family: ${this.theme.fonts.heading}; color: ${this.theme.colors.greenPrimary};">0</div></div>
          <div class="result-item"><div class="label" style="font-family: ${this.theme.fonts.body};">التقدير العام</div><div class="grade-value" id="result-grade" style="font-family: ${this.theme.fonts.heading};">غير محدد</div></div>
        </div>
      </div>
      <div class="info-section">
        <div class="section-title"><div class="icon">✍️</div><span style="font-family: ${this.theme.fonts.heading};">التوقيعات</span></div>
        <div class="signatures-grid">${signaturesHtml}</div>
        ${form.finalSignature ? `<div class="signature-box" style="margin-top: 1.5rem; background: linear-gradient(135deg, rgba(10,122,61,0.08), rgba(200,148,10,0.05)); border-style: solid; border-color: ${this.theme.colors.greenLight};">
          <div class="title" style="color: ${this.theme.colors.greenPrimary}; font-size: 1.1rem; font-family: ${this.theme.fonts.heading};">${form.finalSignature}</div>
          <div class="line"></div>
        </div>` : ''}
      </div>
      <div class="action-bar no-print">
        <button class="btn btn-ghost" onclick="App.goBack()"><span>→</span><span>رجوع</span></button>
        <button class="btn btn-success" onclick="App.saveForm()" style="background: linear-gradient(135deg, ${this.theme.colors.greenDark}, ${this.theme.colors.greenDarker});"><span>💾</span><span>حفظ التقييم</span></button>
        <button class="btn btn-primary" onclick="App.printForm()" style="background: linear-gradient(135deg, ${this.theme.colors.gold}, ${this.theme.colors.goldAccent});"><span>🖨️</span><span>طباعة / PDF</span></button>
        <button class="btn btn-danger" onclick="App.resetForm()"><span>🔄</span><span>تفريغ</span></button>
      </div>`;
  },

  calculateScore(input) {
    const max = parseInt(input.dataset.max);
    let value = parseInt(input.value) || 0;
    if (value < 0) value = 0;
    if (value > max) { value = max; input.value = max; this.showToast('الدرجة لا تتجاوز المفترضة', 'warning'); }
    input.className = 'score-input';
    const pct = (value / max) * 100;
    if (pct >= 90) input.classList.add('score-excellent');
    else if (pct >= 70) input.classList.add('score-good');
    else if (pct >= 50) input.classList.add('score-average');
    else input.classList.add('score-poor');
    this.updateTotal();
  },

  updateTotal() {
    const inputs = document.querySelectorAll('.score-input');
    let total = 0, filled = 0;
    inputs.forEach(inp => {
      const val = parseInt(inp.value) || 0;
      total += val;
      if (val > 0) filled++;
    });
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('total-cell', total);
    setText('result-total', total);
    setText('total-score', total);
    const grade = this.getGrade(total);
    setText('grade-display', grade.label);
    const resultGrade = document.getElementById('result-grade');
    if (resultGrade) { resultGrade.textContent = grade.label; resultGrade.className = 'grade-value ' + grade.cls; }
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = Math.round((filled / inputs.length) * 100) + '%';
    const pp = document.getElementById('progress-percent');
    if (pp) pp.textContent = Math.round((filled / inputs.length) * 100) + '%';
    document.querySelectorAll('.grade-cell').forEach(cell => {
      cell.classList.remove('active', 'active-excellent', 'active-verygood', 'active-good', 'active-acceptable', 'active-weak');
      const min = parseInt(cell.dataset.min), max = parseInt(cell.dataset.max);
      if (total >= min && total <= max) cell.classList.add('active', 'active-' + cell.dataset.grade);
    });
  },

  getGrade(score) {
    if (score >= 90) return { label: 'ممتاز', cls: 'grade-excellent' };
    if (score >= 80) return { label: 'جيد جداً', cls: 'grade-verygood' };
    if (score >= 70) return { label: 'جيد', cls: 'grade-good' };
    if (score >= 60) return { label: 'مقبول', cls: 'grade-acceptable' };
    return { label: 'ضعيف', cls: 'grade-weak' };
  },

  async saveForm() {
    if (!this.currentForm) return;

    const form = this.formsData[this.currentForm];
    const requiredInputs = document.querySelectorAll('.form-control[required]');
    let missing = false;
    requiredInputs.forEach(inp => {
      if (!inp.value.trim()) {
        inp.style.borderColor = '#dc2626';
        inp.style.background = '#fef2f2';
        missing = true;
      } else {
        inp.style.borderColor = '';
        inp.style.background = '';
      }
    });

    if (missing) {
      this.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    // التحقق من targetId
    const targetIdInput = document.querySelector('[name="targetId"]');
    if (targetIdInput && !targetIdInput.value) {
      this.showToast('يرجى اختيار الشخص المُقيَّم', 'error');
      return;
    }

    try {
      const formData = this.collectFormData();
      const evalData = {
        formType: this.currentForm,
        formTitle: form.title,
        evaluatorId: Auth.user.id,
        evaluatorName: Auth.user.name,
        evaluatorRole: Auth.user.role,
        targetId: formData.targetId || targetIdInput?.value,
        ...formData
      };

      await DB.addEvaluation(evalData);
      await DB.addLog(Auth.user.id, 'save_eval', `حفظ تقييم ${form.title}`);
      this.showToast('تم حفظ التقييم بنجاح!', 'success');
      setTimeout(() => this.goBack(), 1500);
    } catch (err) {
      console.error('[NIAS] saveForm error:', err);
      this.showToast(err.message || 'فشل في حفظ التقييم', 'error');
    }
  },

  collectFormData() {
    const data = {};
    document.querySelectorAll('.form-control').forEach(inp => {
      if (inp.name) data[inp.name] = inp.value;
    });
    const scores = [];
    document.querySelectorAll('.eval-table tbody tr[data-indicator-id]').forEach(row => {
      const id = row.dataset.indicatorId;
      const scoreInput = row.querySelector('.score-input');
      const noteInput = row.querySelector('.note-input');
      scores.push({ id, score: parseInt(scoreInput?.value) || 0, note: noteInput?.value || '' });
    });
    data.scores = scores;
    data.total = document.getElementById('total-cell')?.textContent || '0';
    return data;
  },

  printForm() { window.print(); },

  resetForm() {
    this.confirm('تفريغ النموذج', 'هل أنت متأكد من تفريغ النموذج؟ سيتم فقدان البيانات غير المحفوظة.', () => {
      this.renderForm(this.formsData[this.currentForm]);
      this.showToast('تم تفريغ النموذج', 'success');
    });
  },

  goBack() {
    document.getElementById('form-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    this.currentForm = null;
    this.renderDashboard();
    window.scrollTo(0, 0);
  },

  // ===================== Toast & Modal =====================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span style="font-size:1.3rem">${icons[type] || icons.info}</span><span style="font-weight:700">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-30px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  confirm(title, message, onConfirm) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal" style="max-width:400px">
      <div class="modal-head"><h3 style="font-family: ${this.theme.fonts.heading};">${title}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body"><p style="font-family: ${this.theme.fonts.body}; line-height:1.8">${message}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
        <button class="btn btn-primary" id="confirm-btn" style="background: linear-gradient(135deg, ${this.theme.colors.greenDark}, ${this.theme.colors.greenDarker});">تأكيد</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    const confirmBtn = document.getElementById('confirm-btn');
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      if (onConfirm) onConfirm();
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  },

  // ===================== الوضع الليلي =====================
  applyTheme() {
    const saved = localStorage.getItem('nias_theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  },

  toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('nias_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('nias_theme', 'dark');
    }
  },

  // ===================== مستمعات الأحداث =====================
  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentForm) this.goBack();
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }
  }
};

// ═══════════════════════════════════════════════════════
// بدء التطبيق
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('dashboard-view')) {
    console.error('[NIAS] ❌ عنصر dashboard-view غير موجود');
    return;
  }
  App.init().catch(err => {
    console.error('[NIAS] ❌ فشل في بدء التطبيق:', err);
    alert('حدث خطأ في تحميل التطبيق. يرجى تحديث الصفحة.');
  });
});

// ─── Service Worker helpers ───
if (typeof SWRegistration !== 'undefined') {
  // التحقق من الاتصال
  SWRegistration.onConnectionChange((online) => {
    console.log(online ? 'متصل' : 'غير متصل');
  });

  // الاستماع للتحديثات
  SWRegistration.onUpdateAvailable((update) => {
    console.log('تحديث جديد:', update);
    update.skip(); // أو update.postpone()
  });

  // تطبيق التحديث
  SWRegistration.applyUpdate();

  // ✅ تم تغليف الـ await داخل دالة async لتجنب SyntaxError
  (async () => {
    try {
      const size = await SWRegistration.getCacheSize();
      console.log(`${size.sizeMB} MB`);
    } catch (err) {
      console.error('[NIAS] ❌ فشل في قراءة حجم الكاش:', err);
    }

    try {
      const response = await SWRegistration.sendMessage('GET_VERSION');
      console.log('[NIAS] إصدار SW:', response);
    } catch (err) {
      console.error('[NIAS] ❌ فشل في التواصل مع الـ SW:', err);
    }
  })();
} else {
  console.warn('[NIAS] ⚠️ SWRegistration غير متوفر (قد يكون sw.js مفقود)');
}

// ═══════════════════════════════════════════════════════════
// وظائف الخروج
// ═══════════════════════════════════════════════════════════
function confirmLogout() {
    const o = document.getElementById('byeOverlay');
    if (o) { o.classList.add('show'); }
}

function closeBye() {
    const o = document.getElementById('byeOverlay');
    if (o) { o.classList.remove('show'); }
}

async function doLogout() {
    try {
        if (typeof Auth !== 'undefined') {
            if (Auth.user && typeof DB !== 'undefined') {
                await DB.addLog(Auth.user.id, 'LOGOUT', `تسجيل خروج: ${Auth.user.username}`).catch(() => {});
            }
            await Auth.clearSession();
        }
    } catch (e) { console.warn('logout cleanup failed', e); }
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            await window.Capacitor.Plugins.App.exitApp();
            return;
        }
    } catch (e) {}
    window.location.href = 'login.html';
}

// ═══ فلتر الفرع للمسؤول ═══
(function initBranchFilter() {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const sel = document.getElementById('branchFilter');
    if (typeof Auth !== 'undefined' && Auth.user && sel) {
      clearInterval(t);
      if (Auth.user.role !== 'admin') return;
      let cur = '';
      try { cur = localStorage.getItem('nias_branch_filter') || ''; } catch (e) {}
      sel.innerHTML = '<option value="">كل الفروع</option>' + DB.BRANCHES.map(b =>
        `<option value="${b}"${b === cur ? ' selected' : ''}>${b.replace('المعهد الوطني للعلوم الإدارية - ', '')}</option>`).join('');
      sel.style.display = '';
      sel.onchange = () => {
        try { localStorage.setItem('nias_branch_filter', sel.value); } catch (e) {}
        location.reload();
      };
    } else if (tries > 100) clearInterval(t);
  }, 100);
})();
