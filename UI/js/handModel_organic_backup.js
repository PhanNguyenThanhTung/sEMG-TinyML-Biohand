import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/**
 * HandModel class manages the high-poly realistic 3D human hand model (FBX),
 * photorealistic PBR skin textures (diffuse + normal map),
 * anatomical bone poses, and smooth quaternion SLERP transitions.
 */
export class HandModel {
    constructor() {
        this.model = null;
        this.bones = {};
        this.targetRotations = {};
        this.isLoaded = false;
        this.currentPose = 'relax';
        this.transitionSpeed = 9.0; // Tốc độ chuyển động mượt mà tự nhiên (~0.25 - 0.35s)

        // Cấu hình 3 trạng thái giải phẫu học (Anatomical Poses) cho Bàn tay phải
        // Finger_0: Ngón cái (Thumb)
        // Finger_4: Ngón trỏ (Index)
        // Finger_3: Ngón giữa (Middle)
        // Finger_2: Ngón áp út (Ring)
        // Finger_1: Ngón út (Pinky)
        this.poses = {
            relax: {
                name: 'Thả lỏng',
                badgeClass: 'state-relax',
                icon: '💤',
                rotations: {
                    // Hiệu ứng Cascade tự nhiên: độ cong tăng dần từ Trỏ -> Giữa -> Áp út -> Út
                    // Ngón trỏ (Finger 4)
                    'Finger_41': { x: 0.04,  y: 0, z: -0.28 },
                    'Finger_42': { x: 0,     y: 0, z: -0.38 },
                    'Finger_43': { x: 0,     y: 0, z: -0.20 },

                    // Ngón giữa (Finger 3)
                    'Finger_31': { x: 0.00,  y: 0, z: -0.38 },
                    'Finger_32': { x: 0,     y: 0, z: -0.52 },
                    'Finger_33': { x: 0,     y: 0, z: -0.25 },

                    // Ngón áp út (Finger 2)
                    'Finger_21': { x: -0.04, y: 0, z: -0.48 },
                    'Finger_22': { x: 0,     y: 0, z: -0.68 },
                    'Finger_23': { x: 0,     y: 0, z: -0.30 },

                    // Ngón út (Finger 1)
                    'Finger_11': { x: -0.08, y: 0, z: -0.58 },
                    'Finger_12': { x: 0,     y: 0, z: -0.80 },
                    'Finger_13': { x: 0,     y: 0, z: -0.35 },

                    // Ngón cái nghỉ tự nhiên (Finger 0)
                    'Finger_00': { x: 0.85,  y: -0.55, z: 0.35 },
                    'Finger_01': { x: 0.13,  y: 0,     z: -0.30 },
                    'Finger_02': { x: -0.16, y: 0,     z: -0.20 }
                }
            },

            fist: {
                name: 'Nắm chặt',
                badgeClass: 'state-fist',
                icon: '✊',
                rotations: {
                    // 4 ngón tay gập sâu sát vào lòng bàn tay theo tỷ lệ PIP > MCP > DIP
                    // Ngón trỏ (Finger 4)
                    'Finger_41': { x: 0.04,  y: 0, z: -1.90 },
                    'Finger_42': { x: 0,     y: 0, z: -1.80 },
                    'Finger_43': { x: 0,     y: 0, z: -1.30 },

                    // Ngón giữa (Finger 3)
                    'Finger_31': { x: 0.00,  y: 0, z: -1.90 },
                    'Finger_32': { x: 0,     y: 0, z: -1.80 },
                    'Finger_33': { x: 0,     y: 0, z: -1.30 },

                    // Ngón áp út (Finger 2)
                    'Finger_21': { x: -0.04, y: 0, z: -1.90 },
                    'Finger_22': { x: 0,     y: 0, z: -1.80 },
                    'Finger_23': { x: 0,     y: 0, z: -1.30 },

                    // Ngón út (Finger 1)
                    'Finger_11': { x: -0.08, y: 0, z: -1.90 },
                    'Finger_12': { x: 0,     y: 0, z: -1.80 },
                    'Finger_13': { x: 0,     y: 0, z: -1.30 },

                    // Ngón cái đối ngón (Opposition): khép ngang ôm lấy ngón trỏ và ngón giữa
                    'Finger_00': { x: 1.05,  y: 0.05, z: -0.25 },
                    'Finger_01': { x: 0.13,  y: 0,    z: -0.85 },
                    'Finger_02': { x: -0.16, y: 0,    z: -0.75 }
                }
            },

            open: {
                name: 'Xòe tay',
                badgeClass: 'state-open',
                icon: '🖐️',
                rotations: {
                    // 5 ngón tay duỗi thẳng và tản rộng hình nan quạt (Abduction)
                    // Ngón trỏ (Finger 4) - tản về phía ngón cái
                    'Finger_41': { x: 0.22,  y: 0, z: 0.05 },
                    'Finger_42': { x: 0,     y: 0, z: 0.00 },
                    'Finger_43': { x: 0,     y: 0, z: 0.00 },

                    // Ngón giữa (Finger 3) - trục trung tâm
                    'Finger_31': { x: 0.05,  y: 0, z: 0.05 },
                    'Finger_32': { x: 0,     y: 0, z: 0.00 },
                    'Finger_33': { x: 0,     y: 0, z: 0.00 },

                    // Ngón áp út (Finger 2) - tản về phía ngón út
                    'Finger_21': { x: -0.12, y: 0, z: 0.05 },
                    'Finger_22': { x: 0,     y: 0, z: 0.00 },
                    'Finger_23': { x: 0,     y: 0, z: 0.00 },

                    // Ngón út (Finger 1) - tản rộng tối đa về phía ngoài
                    'Finger_11': { x: -0.26, y: 0, z: 0.05 },
                    'Finger_12': { x: 0,     y: 0, z: 0.00 },
                    'Finger_13': { x: 0,     y: 0, z: 0.00 },

                    // Ngón cái mở rộng sang bên (Extension + Abduction)
                    'Finger_00': { x: 1.15,  y: -1.05, z: 0.85 },
                    'Finger_01': { x: 0.13,  y: 0,     z: 0.05 },
                    'Finger_02': { x: -0.16, y: 0,     z: 0.00 }
                }
            }
        };
    }

    /**
     * Tải mô hình 3D bàn tay chi tiết cao (Realistic Hand FBX) cùng Texture da chân thực
     */
    load(scene, onProgress, onComplete, onError) {
        const loadingManager = new THREE.LoadingManager();
        const texLoader = new THREE.TextureLoader(loadingManager);

        // Tải texture độ phân giải cao 2048x2048 (Diffuse map + Normal map)
        const diffuseMap = texLoader.load('./assets/hand_diffuse.jpg');
        const normalMap = texLoader.load('./assets/hand_normal.jpg');

        const loader = new FBXLoader(loadingManager);

        loader.load(
            './assets/hand_base.fbx',
            (object) => {
                this.model = object;

                // Áp dụng PBR skin material với pore & wrinkle details
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material = new THREE.MeshStandardMaterial({
                            map: diffuseMap,
                            normalMap: normalMap,
                            roughness: 0.45,
                            metalness: 0.05
                        });
                    }
                    if (child.isBone || child.name) {
                        this.bones[child.name] = child;
                    }
                });

                // Căn giữa mô hình và chuẩn hóa tỷ lệ hiển thị
                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                this.model.position.sub(center);

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.0 / maxDim;

                // scale.x âm để tạo bàn tay phải chuẩn xác (Right Hand)
                this.model.scale.set(-scale, scale, scale);

                // Căn giữa lại sau khi scale
                const newBox = new THREE.Box3().setFromObject(this.model);
                const newCenter = newBox.getCenter(new THREE.Vector3());
                this.model.position.sub(newCenter);

                // Xoay bàn tay đứng thẳng tự nhiên (Cẳng tay ở dưới, bàn tay ngón tay ở trên)
                this.model.rotation.set(-Math.PI * 0.5, 0, 0);

                scene.add(this.model);

                // Khởi tạo quaternion mục tiêu cho từng khớp xương
                for (const [name, bone] of Object.entries(this.bones)) {
                    this.targetRotations[name] = bone.quaternion.clone();
                }

                this.isLoaded = true;
                this.setPose(this.currentPose, true); // Đặt trạng thái ban đầu ngay lập tức

                if (onComplete) onComplete(this);
            },
            (xhr) => {
                if (onProgress) onProgress(xhr);
            },
            (error) => {
                console.error('Lỗi khi tải mô hình 3D bàn tay chân thực:', error);
                if (onError) onError(error);
            }
        );
    }

    /**
     * Chuyển đổi trạng thái bàn tay ('relax' | 'fist' | 'open')
     * @param {string} poseName
     * @param {boolean} immediate Nếu true sẽ áp dụng ngay không cần nội suy
     */
    setPose(poseName, immediate = false) {
        if (!this.poses[poseName]) {
            console.warn(`Trạng thái không hợp lệ: ${poseName}`);
            return;
        }

        this.currentPose = poseName;
        const poseData = this.poses[poseName];

        for (const [boneName, rot] of Object.entries(poseData.rotations)) {
            const bone = this.bones[boneName];
            if (bone) {
                const targetEuler = new THREE.Euler(rot.x, rot.y, rot.z, 'XYZ');
                const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);
                this.targetRotations[boneName] = targetQuat;

                if (immediate) {
                    bone.quaternion.copy(targetQuat);
                }
            }
        }
    }

    /**
     * Cập nhật chuyển động nội suy mượt mà qua Quaternion SLERP mỗi khung hình
     */
    update(deltaTime) {
        if (!this.isLoaded) return;

        // Tỷ lệ nội suy mượt mà theo thời gian thực (độc lập với FPS)
        const t = Math.min(1.0, deltaTime * this.transitionSpeed);

        for (const [name, targetQuat] of Object.entries(this.targetRotations)) {
            const bone = this.bones[name];
            if (bone) {
                bone.quaternion.slerp(targetQuat, t);
            }
        }
    }

    getCurrentPose() {
        return this.currentPose;
    }

    getPoseInfo(poseName) {
        return this.poses[poseName || this.currentPose];
    }
}
