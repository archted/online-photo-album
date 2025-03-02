class PhotoAlbum {
    constructor() {
        // GitHub 配置
        this.githubConfig = {
            owner: '你的GitHub用户名',  // 替换为你的 GitHub 用户名
            repo: 'photo-album',     // 替换为你的仓库名
            token: '你的GitHub Token', // 替换为你的 GitHub Token
            branch: 'main'
        };

        this.currentPage = 0;
        this.photos = [];
        this.loadPhotosFromGitHub();
        
        this.container = document.querySelector('.page-container');
        this.pageNumber = document.querySelector('.page-number');
        
        this.isEditMode = false;
        this.setupAdminControls();
        this.init();
        this.bindEvents();

        this.statusElement = document.querySelector('.upload-status');
        this.statusText = document.querySelector('.status-text');
        this.progressBar = document.querySelector('.progress');

        // 添加发布状态
        this.isPublished = false;
        this.publishedUrl = '';
    }

    async loadPhotosFromGitHub() {
        try {
            // 获取 images 目录下的所有文件
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/images`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`
                }
            });
            const files = await response.json();
            
            if (!Array.isArray(files)) return;
            
            this.photos = files
                .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file.name))
                .map(file => file.download_url);
                
            this.refreshGallery();
        } catch (error) {
            console.error('加载图片失败:', error);
        }
    }

    showStatus(show = true, message = '') {
        this.statusElement.style.display = show ? 'block' : 'none';
        if (message) {
            this.statusText.textContent = message;
        }
    }

    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
    }

    async uploadToGitHub(file) {
        try {
            // 显示上传状态
            this.showStatus(true, '准备上传...');
            this.updateProgress(0);
            
            // 检查文件大小（限制为 5MB）
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('文件大小不能超过 5MB');
            }

            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 50; // 前50%是读取进度
                    this.updateProgress(percent);
                    this.statusText.textContent = '正在读取文件...';
                }
            };
            
            reader.onload = async () => {
                try {
                    this.statusText.textContent = '正在上传到服务器...';
                    const content = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
                    const filename = `images/${Date.now()}_${file.name}`;
                    
                    const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filename}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: `上传图片: ${file.name}`,
                            content: content,
                            branch: this.githubConfig.branch
                        })
                    });

                    this.updateProgress(90);

                    if (response.ok) {
                        this.statusElement.classList.add('success');
                        this.statusText.textContent = '上传成功！';
                        this.updateProgress(100);
                        
                        // 刷新相册
                        await this.loadPhotosFromGitHub();
                        
                        // 3秒后隐藏状态
                        setTimeout(() => {
                            this.showStatus(false);
                            this.statusElement.classList.remove('success');
                            this.updateProgress(0);
                        }, 3000);
                    } else {
                        throw new Error('上传失败');
                    }
                } catch (error) {
                    throw error;
                }
            };
        } catch (error) {
            console.error('上传失败:', error);
            this.statusElement.classList.add('error');
            this.statusText.textContent = `上传失败: ${error.message}`;
            this.updateProgress(100);
            
            // 3秒后隐藏错误信息
            setTimeout(() => {
                this.showStatus(false);
                this.statusElement.classList.remove('error');
                this.updateProgress(0);
            }, 3000);
        }
    }

    async deleteFromGitHub(photoUrl) {
        try {
            this.showStatus(true, '正在删除...');
            this.updateProgress(50);

            // 获取文件信息
            const filename = photoUrl.split('/').pop();
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/images/${filename}`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`
                }
            });
            const fileInfo = await response.json();

            // 删除文件
            await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/images/${filename}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `删除图片: ${filename}`,
                    sha: fileInfo.sha,
                    branch: this.githubConfig.branch
                })
            });

            this.statusElement.classList.add('success');
            this.statusText.textContent = '删除成功！';
            this.updateProgress(100);
            
            await this.loadPhotosFromGitHub();
            
            setTimeout(() => {
                this.showStatus(false);
                this.statusElement.classList.remove('success');
                this.updateProgress(0);
            }, 3000);
        } catch (error) {
            console.error('删除失败:', error);
            this.statusElement.classList.add('error');
            this.statusText.textContent = '删除失败，请重试';
            this.updateProgress(100);
            
            setTimeout(() => {
                this.showStatus(false);
                this.statusElement.classList.remove('error');
                this.updateProgress(0);
            }, 3000);
        }
    }

    setupAdminControls() {
        // 添加图片
        const addImageBtn = document.getElementById('addImageBtn');
        const imageUpload = document.getElementById('imageUpload');
        
        addImageBtn.addEventListener('click', () => {
            imageUpload.click();
        });

        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.uploadToGitHub(file);
            }
        });

        // 切换编辑模式
        const toggleEditMode = document.getElementById('toggleEditMode');
        toggleEditMode.addEventListener('click', () => {
            this.isEditMode = !this.isEditMode;
            document.querySelector('.photo-album').classList.toggle('edit-mode');
            toggleEditMode.textContent = this.isEditMode ? '退出编辑' : '切换编辑模式';
        });

        // 获取分享链接
        document.getElementById('getShareLink').addEventListener('click', () => {
            const shareUrl = new URL(window.location.href);
            shareUrl.searchParams.set('mode', 'view');
            alert('分享链接：' + shareUrl.href);
        });

        // 发布按钮
        const publishBtn = document.getElementById('publishBtn');
        publishBtn.addEventListener('click', () => this.publishAlbum());

        // 分享按钮
        const shareBtn = document.getElementById('shareBtn');
        shareBtn.addEventListener('click', () => this.shareToDD());
    }
    
    init() {
        this.container.innerHTML = ''; // 清空容器
        // 检查是否是查看模式
        const urlParams = new URLSearchParams(window.location.search);
        const isViewMode = urlParams.get('mode') === 'view';

        if (isViewMode) {
            document.querySelector('.admin-panel').style.display = 'none';
        }

        this.photos.forEach((photo, index) => {
            const page = document.createElement('div');
            page.className = 'page';
            page.style.transform = `translateX(${index * 100}%)`;
            
            const img = document.createElement('img');
            img.src = photo;
            img.alt = `照片 ${index + 1}`;
            
            // 添加删除按钮
            if (!isViewMode) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '删除';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deletePhoto(index);
                };
                page.appendChild(deleteBtn);
            }
            
            page.appendChild(img);
            this.container.appendChild(page);
        });
        
        this.updatePageNumber();
    }
    
    bindEvents() {
        document.querySelector('.prev-btn').addEventListener('click', () => this.prevPage());
        document.querySelector('.next-btn').addEventListener('click', () => this.nextPage());
        
        // 添加触摸支持
        let startX = 0;
        let isDragging = false;
        
        this.container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        });
        
        this.container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.prevPage();
                } else {
                    this.nextPage();
                }
                isDragging = false;
            }
        });
        
        this.container.addEventListener('touchend', () => {
            isDragging = false;
        });
    }
    
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updatePage();
        }
    }
    
    nextPage() {
        if (this.currentPage < this.photos.length - 1) {
            this.currentPage++;
            this.updatePage();
        }
    }
    
    updatePage() {
        this.container.style.transform = `translateX(-${this.currentPage * 100}%)`;
        this.updatePageNumber();
    }
    
    updatePageNumber() {
        this.pageNumber.textContent = `${this.currentPage + 1} / ${this.photos.length}`;
    }

    deletePhoto(index) {
        if (confirm('确定要删除这张照片吗？')) {
            const photoUrl = this.photos[index];
            this.deleteFromGitHub(photoUrl);
        }
    }

    refreshGallery() {
        this.init();
        this.updatePage();
    }

    async publishAlbum() {
        try {
            this.showStatus(true, '正在发布相册...');
            this.updateProgress(30);

            // 获取 GitHub Pages 设置
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/pages`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const pagesData = await response.json();
                this.publishedUrl = pagesData.html_url;
                this.isPublished = true;
                
                this.updateProgress(100);
                this.statusElement.classList.add('success');
                this.statusText.textContent = '发布成功！';
                
                // 保存发布状态
                localStorage.setItem('publishedUrl', this.publishedUrl);
                
                setTimeout(() => {
                    this.showStatus(false);
                    this.statusElement.classList.remove('success');
                    this.updateProgress(0);
                }, 3000);
            } else {
                throw new Error('获取 GitHub Pages 设置失败');
            }
        } catch (error) {
            console.error('发布失败:', error);
            this.statusElement.classList.add('error');
            this.statusText.textContent = '发布失败，请确保已开启 GitHub Pages';
            this.updateProgress(100);
            
            setTimeout(() => {
                this.showStatus(false);
                this.statusElement.classList.remove('error');
                this.updateProgress(0);
            }, 3000);
        }
    }

    async shareToDD() {
        try {
            if (!this.isPublished && !localStorage.getItem('publishedUrl')) {
                throw new Error('请先发布相册');
            }

            const shareUrl = this.publishedUrl || localStorage.getItem('publishedUrl');
            const viewUrl = new URL(shareUrl);
            viewUrl.searchParams.set('mode', 'view');

            // 构建钉钉分享内容
            const shareContent = {
                title: '优雅电子相册',
                content: '查看我的电子相册',
                url: viewUrl.href,
                pic: this.photos[0] || '' // 使用第一张图片作为预览
            };

            // 使用钉钉分享API
            if (window.DingTalkPC) {
                window.DingTalkPC.biz.util.share({
                    type: 0,
                    ...shareContent,
                    onSuccess: () => {
                        this.showStatus(true, '分享成功！');
                        this.statusElement.classList.add('success');
                        this.updateProgress(100);
                        
                        setTimeout(() => {
                            this.showStatus(false);
                            this.statusElement.classList.remove('success');
                            this.updateProgress(0);
                        }, 3000);
                    },
                    onFail: () => {
                        throw new Error('钉钉分享失败');
                    }
                });
            } else {
                // 如果不在钉钉环境，则复制链接
                navigator.clipboard.writeText(viewUrl.href);
                this.showStatus(true, '链接已复制，请手动粘贴到钉钉群');
                this.statusElement.classList.add('success');
                this.updateProgress(100);
                
                setTimeout(() => {
                    this.showStatus(false);
                    this.statusElement.classList.remove('success');
                    this.updateProgress(0);
                }, 3000);
            }
        } catch (error) {
            console.error('分享失败:', error);
            this.statusElement.classList.add('error');
            this.statusText.textContent = error.message;
            this.updateProgress(100);
            
            setTimeout(() => {
                this.showStatus(false);
                this.statusElement.classList.remove('error');
                this.updateProgress(0);
            }, 3000);
        }
    }
}

// 初始化相册
document.addEventListener('DOMContentLoaded', () => {
    new PhotoAlbum();
}); 