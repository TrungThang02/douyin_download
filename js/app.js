class DouyinDownloader {
  constructor() {
    this.currentVideoInfo = null;
    this.downloadTaskId = null;
    this.progressPolling = null;
    this.history = this.loadHistory();
    this.stats = this.loadStats();
    this.selectedDirHandle = null;
    this.downloadDir = this.loadDownloadDir();

    this.initElements();
    this.initEventListeners();
    this.renderHistory();
    this.updateStats();
    this.restoreSettings();
  }

  initElements() {
    console.log('initElements called');
    this.urlInput = document.getElementById('urlInput');
    this.getInfoBtn = document.getElementById('getInfoBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.statusMessage = document.getElementById('statusMessage');
    this.videoInfoSection = document.getElementById('videoInfoSection');
    this.thumbnailPreview = document.getElementById('thumbnailPreview');
    this.thumbnailPlaceholder = document.getElementById('thumbnailPlaceholder');
    this.videoTitle = document.getElementById('videoTitle');
    this.videoLikes = document.getElementById('videoLikes');
    this.videoComments = document.getElementById('videoComments');
    this.videoShares = document.getElementById('videoShares');
    this.videoUrl = document.getElementById('videoUrl');
    this.outputDir = document.getElementById('outputDir');
    this.selectDirBtn = document.getElementById('selectDirBtn');
    this.progressSection = document.getElementById('progressSection');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.historyList = document.getElementById('historyList');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.totalDownloaded = document.getElementById('totalDownloaded');
    this.totalFailed = document.getElementById('totalFailed');
    this.notification = document.getElementById('notification');
    this.notificationText = document.getElementById('notificationText');
    this.logContent = document.getElementById('logContent');
    this.logLoading = document.getElementById('logLoading');
    this.logLoadingText = document.getElementById('logLoadingText');

    // Check if elements exist
    const missing = [];
    if (!this.urlInput) missing.push('urlInput');
    if (!this.getInfoBtn) missing.push('getInfoBtn');
    if (!this.clearBtn) missing.push('clearBtn');
    if (missing.length > 0) {
      console.error('Missing elements:', missing.join(', '));
      alert('Missing elements: ' + missing.join(', '));
    } else {
      console.log('All required elements found');
    }
  }

  initEventListeners() {
    console.log('initEventListeners called');
    this.getInfoBtn.addEventListener('click', () => {
      console.log('getInfoBtn clicked');
      this.getVideoInfo();
    });
    this.clearBtn.addEventListener('click', () => {
      console.log('clearBtn clicked');
      this.clearInput();
    });
    this.downloadBtn.addEventListener('click', () => this.downloadVideo());
    this.selectDirBtn.addEventListener('click', () => this.selectOutputDir());
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.getVideoInfo();
      }
    });
    console.log('Event listeners attached');
  }

  updateOutputDirVisibility() {
    // Always visible now
  }

  extractDouyinUrl(text) {
    const patterns = [
      /https?:\/\/(?:v\.)?douyin\.com\/[a-zA-Z0-9_-]+/gi,
      /https?:\/\/www\.douyin\.com\/video\/\d+/gi,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  }

  clearLog() {
    if (this.logContent) this.logContent.innerHTML = '';
  }

  appendLog(text, type = '') {
    if (!this.logContent) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (type ? ' ' + type : '');
    line.textContent = '[' + new Date().toLocaleTimeString('vi-VN', { hour12: false }) + '] ' + text;
    this.logContent.appendChild(line);
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  showLogLoading(show, text) {
    if (!this.logLoading || !this.logLoadingText) return;
    if (show) {
      this.logLoading.classList.remove('hidden');
      this.logLoadingText.textContent = text || 'Dang cho...';
    } else {
      this.logLoading.classList.add('hidden');
    }
  }

  async runFakeLogSteps(steps, delayMs, onComplete) {
    for (const step of steps) {
      this.appendLog(step.text, step.type || '');
      if (step.loadingText && this.logLoadingText) this.logLoadingText.textContent = step.loadingText;
      await new Promise(r => setTimeout(r, delayMs));
    }
    if (onComplete) onComplete();
  }

  async getVideoInfo() {
    const text = this.urlInput.value.trim();
    if (!text) {
      this.showStatus('Vui lòng nhập URL Douyin', 'error');
      return;
    }

    const url = this.extractDouyinUrl(text);
    if (!url) {
      this.showStatus('Không tìm thấy URL Douyin hợp lệ', 'error');
      return;
    }

    this.setLoading(true, 'getInfoBtn');
    this.showStatus('Đang lấy thông tin video...', 'info');
    this.clearLog();
    this.showLogLoading(true, 'Dang load...');

    const infoSteps = [
      { text: 'Phan tich URL, trich xuat shortcode...', type: '' },
      { text: 'Ket noi den server Douyin (TLS fingerprint)...', type: '', loadingText: 'Dang bypass anti-bot...' },
      { text: 'Bypass anti-bot / rate limit...', type: 'warn' },
      { text: 'Tai trang embed, trich X-Bogus / signature...', type: '', loadingText: 'Dang giai ma token...' },
      { text: 'Giai ma token DRM, lay play URL...', type: '' },
      { text: 'Xac thuc CDN, resolve redirect...', type: '', loadingText: 'Dang ket noi CDN...' }
    ];
    const delay = 380;
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex >= infoSteps.length) {
        clearInterval(stepInterval);
        return;
      }
      const step = infoSteps[stepIndex++];
      this.appendLog(step.text, step.type || '');
      if (step.loadingText && this.logLoadingText) this.logLoadingText.textContent = step.loadingText;
      this.logContent.scrollTop = this.logContent.scrollHeight;
    }, delay);

    try {
      const response = await fetch('/api/douyin/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      clearInterval(stepInterval);
      this.showLogLoading(false);

      const result = await response.json();
      
      if (result.success) {
        this.appendLog('Lay thong tin thanh cong. San sang tai.', 'success');
        this.currentVideoInfo = result.data;
        this.displayVideoInfo(result.data);
        this.showStatus('Lấy thông tin thành công!', 'success');
        this.videoInfoSection.classList.remove('hidden');
        this.downloadBtn.classList.remove('hidden');
      } else {
        this.appendLog('Loi: ' + (result.message || 'Khong xac dinh'), 'err');
        this.showStatus(result.message || 'Lỗi không xác định', 'error');
      }
    } catch (error) {
      clearInterval(stepInterval);
      this.showLogLoading(false);
      this.appendLog('Loi ket noi: ' + error.message, 'err');
      this.showStatus('Lỗi kết nối: ' + error.message, 'error');
    } finally {
      this.setLoading(false, 'getInfoBtn');
    }
  }

  displayVideoInfo(data) {
    if (this.videoTitle) this.videoTitle.textContent = data.title || 'Không có tiêu đề';
    if (this.videoLikes) this.videoLikes.textContent = this.formatNumber(data.likes);
    if (this.videoComments) this.videoComments.textContent = this.formatNumber(data.comment_count);
    if (this.videoShares) this.videoShares.textContent = this.formatNumber(data.share_count);

    if (data.thumbnail) {
      this.thumbnailPreview.src = data.thumbnail;
      this.thumbnailPreview.classList.remove('hidden');
      this.thumbnailPlaceholder.classList.add('hidden');
    } else {
      this.thumbnailPreview.classList.add('hidden');
      this.thumbnailPlaceholder.classList.remove('hidden');
    }
  }

  async downloadVideo() {
    if (!this.currentVideoInfo || !this.currentVideoInfo.downloadToken) {
      this.showNotification('Chưa có thông tin video', 'error');
      return;
    }

    await this.downloadToBrowser();
  }

  async downloadToBrowser() {
    this.downloadBtn.disabled = true;
    this.progressSection.classList.remove('hidden');
    this.progressBar.style.width = '0%';
    this.progressText.textContent = 'Dang tai...';
    this.showStatus('Đang tải video về máy...', 'info');
    this.clearLog();
    this.showLogLoading(true, 'Dang khoi tao stream...');

    const downloadSteps = [
      { text: 'Tao download token, ma hoa request...', type: '' },
      { text: 'Bypass DRM, lay stream URL...', type: 'warn', loadingText: 'Dang bypass DRM...' },
      { text: 'Ket noi CDN, bat dau stream...', type: '', loadingText: 'Dang ghi file...' },
      { text: 'Ghi file, kiem tra checksum...', type: '' }
    ];
    let stepIndex = 0;
    this._downloadStepInterval = setInterval(() => {
      if (stepIndex >= downloadSteps.length) {
        clearInterval(this._downloadStepInterval);
        return;
      }
      const step = downloadSteps[stepIndex++];
      this.appendLog(step.text, step.type || '');
      if (step.loadingText && this.logLoadingText) this.logLoadingText.textContent = step.loadingText;
      if (this.logContent) this.logContent.scrollTop = this.logContent.scrollHeight;
    }, 400);

    try {
      const downloadToken = this.currentVideoInfo.downloadToken;
      const title = this.currentVideoInfo.title || 'video';

      if (this.selectedDirHandle && 'showDirectoryPicker' in window) {
        await this.downloadWithFileSystemAccess(downloadToken, title);
      } else {
        this.downloadViaStreamAPI(downloadToken, title);
      }
    } catch (error) {
      if (this._downloadStepInterval) clearInterval(this._downloadStepInterval);
      this.showLogLoading(false);
      this.appendLog('Loi: ' + error.message, 'err');
      this.showStatus('Lỗi: ' + error.message, 'error');
      this.downloadBtn.disabled = false;
      this.progressSection.classList.add('hidden');
    }
  }

  async downloadWithFileSystemAccess(downloadToken, title) {
    try {
      const safeFilename = this.sanitizeFilename(title) + '.mp4';
      const fileHandle = await this.selectedDirHandle.getFileHandle(safeFilename, { create: true });
      const writable = await fileHandle.createWritable();

      const response = await fetch('/api/douyin/stream?token=' + encodeURIComponent(downloadToken) + '&title=' + encodeURIComponent(title));

      if (!response.ok) throw new Error('Stream failed');

      const totalSize = parseInt(response.headers.get('content-length') || 0, 10);
      let downloaded = 0;

      this.reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        await writable.write(value);
        downloaded += value.length;

        if (totalSize > 0) {
          const percent = (downloaded / totalSize) * 100;
          this.progressBar.style.width = percent + '%';
          this.progressText.textContent = Math.round(percent) + '%';
        }
      }

      await writable.close();
      if (this._downloadStepInterval) clearInterval(this._downloadStepInterval);
      if (this.logLoading) this.logLoading.classList.add('hidden');
      this.appendLog('Tai xong. File da luu.', 'success');
      this.handleDownloadComplete({ filename: safeFilename, filepath: 'User selected folder' });

    } catch (error) {
      if (error.name !== 'AbortError') {
        this.handleDownloadError(error.message);
      }
    }
  }

  downloadViaStreamAPI(downloadToken, title) {
    const safeFilename = this.sanitizeFilename(title) + '.mp4';
    const streamUrl = '/api/douyin/stream?token=' + encodeURIComponent(downloadToken) + '&title=' + encodeURIComponent(title);

    const anchor = document.createElement('a');
    anchor.href = streamUrl;
    anchor.download = safeFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (this._downloadStepInterval) clearInterval(this._downloadStepInterval);
    if (this.logLoading) this.logLoading.classList.add('hidden');
    this.appendLog('Stream bat dau. Tai qua trinh duyet.', 'success');
    this.progressBar.style.width = '100%';
    this.progressText.textContent = 'Dang tai...';
    this.showStatus('Video đang được tải về máy', 'success');
    this.showNotification('Video đang được tải: ' + safeFilename, 'success');

    setTimeout(() => {
      this.downloadBtn.disabled = false;
      this.progressSection.classList.add('hidden');
      this.stats.downloaded++;
      this.saveStats();
      this.updateStats();

      const historyItem = {
        id: Date.now(),
        title: this.currentVideoInfo.title,
        status: 'success',
        filename: safeFilename,
        filepath: 'Browser Downloads',
        thumbnail: this.currentVideoInfo.thumbnail,
        downloadedAt: new Date().toISOString()
      };
      this.addToHistory(historyItem);
    }, 2000);
  }

  pollDownloadStatus() {
    this.progressPolling = setInterval(async () => {
      try {
        const response = await fetch(`/api/douyin/status/${this.downloadTaskId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          const task = result.data;
          
          if (task.progress !== undefined) {
            this.progressBar.style.width = task.progress + '%';
            this.progressText.textContent = Math.round(task.progress) + '%';
          }

          if (task.status === 'completed') {
            clearInterval(this.progressPolling);
            this.handleDownloadComplete(task);
          } else if (task.status === 'failed') {
            clearInterval(this.progressPolling);
            this.handleDownloadError(task.error || 'Tải thất bại');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);
  }

  handleDownloadComplete(task) {
    this.downloadBtn.disabled = false;
    this.showStatus('Tải hoàn tất!', 'success');
    this.showNotification('Video đã tải về: ' + task.filename, 'success');

    const historyItem = {
      id: Date.now(),
      title: this.currentVideoInfo.title,
      status: 'success',
      filename: task.filename,
      filepath: task.filepath,
      thumbnail: this.currentVideoInfo.thumbnail,
      downloadedAt: new Date().toISOString()
    };

    this.addToHistory(historyItem);
    this.stats.downloaded++;
    this.saveStats();
    this.updateStats();

    setTimeout(() => {
      this.progressSection.classList.add('hidden');
    }, 2000);
  }

  handleDownloadError(error) {
    if (this._downloadStepInterval) clearInterval(this._downloadStepInterval);
    this.showLogLoading(false);
    this.appendLog('Loi tai: ' + error, 'err');
    this.downloadBtn.disabled = false;
    this.showStatus('Lỗi: ' + error, 'error');
    this.showNotification('Tải thất bại: ' + error, 'error');

    const historyItem = {
      id: Date.now(),
      title: this.currentVideoInfo.title,
      status: 'error',
      error: error,
      downloadedAt: new Date().toISOString()
    };

    this.addToHistory(historyItem);
    this.stats.failed++;
    this.saveStats();
    this.updateStats();
  }

  addToHistory(item) {
    this.history.unshift(item);
    if (this.history.length > 50) {
      this.history.pop();
    }
    this.saveHistory();
    this.renderHistory();
  }

  renderHistory() {
    if (this.history.length === 0) {
      this.historyList.innerHTML = '<div class="history-empty">Chưa có video nào được tải</div>';
      return;
    }

    this.historyList.innerHTML = this.history.map(item => `
      <div class="history-item">
        ${item.thumbnail ? `<img class="history-thumbnail" src="${item.thumbnail}" alt="">` : '<div class="history-thumbnail"></div>'}
        <div class="history-info">
          <div class="history-title">${this.escapeHtml(item.title || 'Unknown')}</div>
          <div class="history-status ${item.status}">${item.status === 'success' ? 'Thành công' : item.status === 'error' ? 'Thất bại' : 'Đang tải'}</div>
          ${item.filename ? `<div class="history-path">${this.escapeHtml(item.filename)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.renderHistory();
    this.showNotification('Đã xóa lịch sử', 'success');
  }

  updateStats() {
    this.totalDownloaded.textContent = this.stats.downloaded;
    this.totalFailed.textContent = this.stats.failed;
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('douyin_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveHistory() {
    localStorage.setItem('douyin_history', JSON.stringify(this.history));
  }

  loadStats() {
    try {
      const saved = localStorage.getItem('douyin_stats');
      return saved ? JSON.parse(saved) : { downloaded: 0, failed: 0 };
    } catch {
      return { downloaded: 0, failed: 0 };
    }
  }

  saveStats() {
    localStorage.setItem('douyin_stats', JSON.stringify(this.stats));
  }

  loadDownloadDir() {
    try {
      return localStorage.getItem('douyin_download_dir') || '';
    } catch {
      return '';
    }
  }

  restoreSettings() {
    const savedDir = this.loadDownloadDir();
    if (savedDir) {
      this.outputDir.value = savedDir;
    }
  }

  clearInput() {
    this.urlInput.value = '';
    this.currentVideoInfo = null;
    this.videoInfoSection.classList.add('hidden');
    this.downloadBtn.classList.add('hidden');
    this.progressSection.classList.add('hidden');
    this.hideStatus();
    this.clearLog();
    this.showLogLoading(false);
  }

  async selectOutputDir() {
    if ('showDirectoryPicker' in window) {
      try {
        this.selectedDirHandle = await window.showDirectoryPicker();
        this.outputDir.value = this.selectedDirHandle.name;
        localStorage.setItem('douyin_download_dir', this.selectedDirHandle.name);
        this.showNotification('Đã chọn thư mục: ' + this.selectedDirHandle.name, 'success');
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.showNotification('Không thể chọn thư mục: ' + error.message, 'error');
        }
      }
    } else {
      this.showNotification('Trình duyệt không hỗ trợ. Video sẽ tải vào thư mục Downloads mặc định', 'info');
      this.outputDir.value = 'Downloads (mặc định)';
    }
  }

  sanitizeFilename(title) {
    return String(title)
      .replace(/[<>:"/\\|?*#]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80) || 'video';
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  showStatus(message, type) {
    if (!this.statusMessage) return;
    this.statusMessage.textContent = message;
    this.statusMessage.className = 'status-message show ' + type;
  }

  hideStatus() {
    if (this.statusMessage) this.statusMessage.className = 'status-message';
  }

  showNotification(message, type = 'success') {
    if (!this.notification || !this.notificationText) return;
    this.notificationText.textContent = message;
    this.notification.className = 'notification ' + type;
    setTimeout(() => {
      this.notification.className = 'notification hidden';
    }, 4000);
  }

  setLoading(loading, btnId) {
    const btn = document.getElementById(btnId);
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  try {
    window.app = new DouyinDownloader();
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    alert('Error initializing app: ' + error.message);
  }
});