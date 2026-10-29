import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HandModel } from './handModel.js?v=7.1';

/**
 * Main Application Module
 */
class App {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.stateBadge = document.getElementById('stateBadge');

        // Buttons
        this.btnRelax = document.getElementById('btnRelax');
        this.btnFist = document.getElementById('btnFist');
        this.btnOpen = document.getElementById('btnOpen');
        this.buttons = [this.btnRelax, this.btnFist, this.btnOpen];

        this.clock = new THREE.Clock();
        this.handModel = new HandModel();

        this.initThree();
        this.initLights();
        this.initEnvironment();
        this.initEvents();
        this.loadModel();
        this.animate();
    }

    /**
     * Khởi tạo Three.js Scene, Camera, Renderer, OrbitControls
     */
    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x080c14, 0.08);

        // Camera (Góc nhìn 3/4 công nghệ để thấy rõ chiều sâu của các đốt ngón tay)
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 50);
        this.camera.position.set(0.85, 0.40, 2.7);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 6.0;
        this.controls.minDistance = 1.0;
        this.controls.target.set(0, 0.15, 0);
        this.controls.update();
    }

    /**
     * Thiết lập ánh sáng studio công nghệ cao (Key light, Fill light, Rim light)
     */
    initLights() {
        // Ánh sáng môi trường
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);

        // Nguồn sáng chính (Key Light)
        const mainLight = new THREE.DirectionalLight(0xfff5ea, 2.8);
        mainLight.position.set(2.5, 4.0, 3.0);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        mainLight.shadow.bias = -0.0005;
        this.scene.add(mainLight);

        // Nguồn sáng phụ (Fill Light mềm)
        const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.0);
        fillLight.position.set(-2.5, 1.0, 2.0);
        this.scene.add(fillLight);

        // Nguồn sáng viền công nghệ (Rim / Accent Light màu xanh cyan)
        const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
        rimLight.position.set(0, 3.0, -3.5);
        this.scene.add(rimLight);
    }

    /**
     * Tạo bục tròn và lưới tọa độ mờ bên dưới
     */
    initEnvironment() {
        // Lưới tọa độ phong cách công nghệ
        const grid = new THREE.GridHelper(5, 20, 0x1e293b, 0x0f172a);
        grid.position.y = -1.0;
        this.scene.add(grid);

        // Bục tròn kim loại mờ
        const pedestalGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.04, 32);
        const pedestalMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.6,
            metalness: 0.4
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.y = -1.02;
        pedestal.receiveShadow = true;
        this.scene.add(pedestal);
    }

    /**
     * Tải mô hình 3D bàn tay
     */
    loadModel() {
        this.handModel.load(
            this.scene,
            (xhr) => {
                // Đang tải...
            },
            () => {
                // Hoàn tất tải
                if (this.loadingOverlay) {
                    this.loadingOverlay.classList.add('hidden');
                }
                
                // Kiểm tra URL param (ví dụ: ?pose=fist hoặc ?pose=open)
                const urlParams = new URLSearchParams(window.location.search);
                const initialPose = urlParams.get('pose') || 'relax';
                this.switchPose(initialPose, true);
            },
            (error) => {
                if (this.loadingOverlay) {
                    this.loadingOverlay.innerHTML = `
                        <p style="color:#ef4444; font-weight:bold;">Không thể tải mô hình 3D</p>
                        <p style="color:#94a3b8; font-size:12px;">Vui lòng kiểm tra file assets/hand_base.fbx</p>
                    `;
                }
            }
        );
    }

    /**
     * Chuyển đổi trạng thái bàn tay
     */
    switchPose(poseName, immediate = false) {
        if (!this.handModel.isLoaded) return;
        this.handModel.setPose(poseName, immediate);
        this.updateUI(poseName);
    }

    /**
     * Cập nhật giao diện (Nút active và Badge trạng thái)
     */
    updateUI(poseName) {
        // Cập nhật nút bấm
        this.buttons.forEach((btn) => {
            if (btn.dataset.pose === poseName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Cập nhật Badge trên cùng
        const info = this.handModel.getPoseInfo(poseName);
        if (info && this.stateBadge) {
            this.stateBadge.className = `current-state-badge ${info.badgeClass}`;
            const iconEl = this.stateBadge.querySelector('.badge-icon');
            const labelEl = this.stateBadge.querySelector('.badge-label');
            if (iconEl) iconEl.textContent = info.icon;
            if (labelEl) labelEl.textContent = `${info.name} (${poseName.toUpperCase()})`;
        }
    }

    /**
     * Đăng ký sự kiện Click và Phím tắt
     */
    initEvents() {
        // Click 3 nút bấm
        this.buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const pose = btn.dataset.pose;
                this.switchPose(pose);
            });
        });

        // Phím tắt bàn phím: 1 -> Thả lỏng, 2 -> Nắm chặt, 3 -> Xòe tay
        window.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                this.switchPose('relax');
            } else if (e.key === '2') {
                this.switchPose('fist');
            } else if (e.key === '3') {
                this.switchPose('open');
            }
        });

        // Tự động điều chỉnh khi thay đổi kích thước cửa sổ
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        });
    }

    /**
     * Vòng lặp Render (60fps)
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Cập nhật chuyển động ngón tay
        this.handModel.update(delta);

        // Cập nhật điều khiển chuột
        this.controls.update();

        // Render ra màn hình
        this.renderer.render(this.scene, this.camera);
    }
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
