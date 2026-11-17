/**
 * NIAS Reports Page
 */
const ReportsApp = {
  async init() {
    await Auth.init();
    if (!(await Auth.requireAuth())) return;
    this.renderUserChip();
    await this.loadReports();
  },

  renderUserChip() {
    const chip = document.getElementById('user-chip');
    const avatar = document.getElementById('user-avatar');
    const nameLabel = document.getElementById('user-name-label');
    const roleLabel = document.getElementById('user-role-label');
    if (!chip || !Auth.user) return;
    const roleInfo = Auth.getRoleInfo(Auth.user.role);
    const initials = Auth.user.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    nameLabel.textContent = Auth.user.name;
    roleLabel.textContent = roleInfo.label;
    avatar.textContent = initials;
    chip.style.display = 'flex';
  },

  async loadReports() {
    try {
      const evals = await DB.getEvaluations();
      const users = await DB.getUsers();
      
      // Stats
      const totalEvals = evals.length;
      const totalUsers = users.length;
      const avgScore = totalEvals > 0 ? (evals.reduce((a, b) => a + (parseFloat(b.total) || 0), 0) / totalEvals).toFixed(1) : '0.0';
      const excellentCount = evals.filter(e => parseFloat(e.total) >= 90).length;

      document.getElementById('rpt-total-evals').textContent = totalEvals;
      document.getElementById('rpt-total-users').textContent = totalUsers;
      document.getElementById('rpt-avg-score').textContent = avgScore;
      document.getElementById('rpt-excellent').textContent = excellentCount;

      // Form distribution
      this.renderFormDistribution(evals);
      // Grade distribution
      this.renderGradeDistribution(evals);
      // Recent evals
      this.renderRecentEvals(evals);
    } catch (err) {
      console.error('Load reports error:', err);
    }
  },

  renderFormDistribution(evals) {
    const forms = {};
    evals.forEach(e => { forms[e.formType] = (forms[e.formType] || 0) + 1; });
    const container = document.getElementById('form-distribution');
    if (!Object.keys(forms).length) {
      container.innerHTML = '<p style="color:var(--text-muted)">لا توجد بيانات</p>';
      return;
    }
    container.innerHTML = Object.entries(forms).map(([type, count]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 1rem;background:var(--surface-hover);border-radius:8px;">
        <span style="font-weight:700;">${type}</span>
        <span class="badge-role badge-admin">${count} تقييم</span>
      </div>`).join('');
  },

  renderGradeDistribution(evals) {
    const grades = { 'ممتاز': 0, 'جيد جداً': 0, 'جيد': 0, 'مقبول': 0, 'ضعيف': 0 };
    evals.forEach(e => {
      const score = parseFloat(e.total) || 0;
      if (score >= 90) grades['ممتاز']++;
      else if (score >= 80) grades['جيد جداً']++;
      else if (score >= 70) grades['جيد']++;
      else if (score >= 60) grades['مقبول']++;
      else grades['ضعيف']++;
    });
    const container = document.getElementById('grade-distribution');
    container.innerHTML = Object.entries(grades).map(([label, count]) => `
      <div style="text-align:center;padding:1rem;background:var(--surface-hover);border-radius:8px;">
        <div style="font-size:1.5rem;font-weight:800;color:var(--primary);">${count}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">${label}</div>
      </div>`).join('');
  },

  async renderRecentEvals(evals) {
    const tbody = document.getElementById('recent-evals-tbody');
    const recent = evals.slice(-10).reverse();
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">لا توجد تقييمات</td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(e => {
      const grade = ReportsApp.getGrade(parseFloat(e.total) || 0);
      return `<tr>
        <td>${e.formType}</td>
        <td>${e.evaluatorName || '-'}</td>
        <td>${e.targetName || '-'}</td>
        <td>${new Date(e.createdAt).toLocaleDateString('ar-SA')}</td>
        <td><strong>${e.total || 0}</strong></td>
        <td><span class="badge-grade ${grade.cls}">${grade.label}</span></td>
      </tr>`;
    }).join('');
  },

  getGrade(score) {
    if (score >= 90) return { label: 'ممتاز', cls: 'grade-excellent' };
    if (score >= 80) return { label: 'جيد جداً', cls: 'grade-verygood' };
    if (score >= 70) return { label: 'جيد', cls: 'grade-good' };
    if (score >= 60) return { label: 'مقبول', cls: 'grade-acceptable' };
    return { label: 'ضعيف', cls: 'grade-weak' };
  }
};

document.addEventListener('DOMContentLoaded', () => ReportsApp.init());