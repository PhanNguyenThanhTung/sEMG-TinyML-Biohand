import * as THREE from 'three';

/**
 * BionicHand - Precision High-Tech Prosthetic Robotic Hand
 * Designed for the sEMG-TinyML-Biohand project.
 * 
 * Features:
 * - Anatomically balanced bionic proportions (Slim aerospace chassis)
 * - Articulated mechanical hinge kinematics (Zero mesh deformation)
 * - True fan-out Abduction in OPEN, anatomical convergence in FIST
 * - Fully articulated Thumb clamp in FIST
 * - Titanium edge trims, polished chrome knuckle pivots & bolts
 * - Dynamic Biometric Status LED Core & Wrist Collar (color-coded per gesture)
 * - Smooth real-time LERP interpolation
 */
export class BionicHand {
    constructor() {
        this.group = new THREE.Group();
        this.isLoaded = false;
        this.currentPose = 'relax';
        this.transitionSpeed = 8.5;

        this.joints = {};
        this.targetAngles = {};
        this.currentAngles = {};
        this.ledMaterials = [];

        // Pose definitions (mechanical joint rotation angles in radians)
        // Fingers curl forward (+X rotation towards +Z palm side)
        // Positive splay = tilt left (-X), Negative splay = tilt right (+X)
        this.poses = {
            relax: {
                name: 'Thả lỏng',
                badgeClass: 'state-relax',
                icon: '💤',
                ledColor: 0x38bdf8, // Cyan biometric
                angles: {
                    // Ngón trỏ (Index - left side at -0.19)
                    index_mcp: 0.30,
                    index_pip: 0.40,
                    index_dip: 0.22,
                    index_splay: 0.04,

                    // Ngón giữa (Middle at -0.06)
                    middle_mcp: 0.35,
                    middle_pip: 0.45,
                    middle_dip: 0.25,
                    middle_splay: 0.0,

                    // Ngón áp út (Ring at +0.07)
                    ring_mcp: 0.42,
                    ring_pip: 0.52,
                    ring_dip: 0.28,
                    ring_splay: -0.04,

                    // Ngón út (Pinky at +0.19)
                    pinky_mcp: 0.48,
                    pinky_pip: 0.60,
                    pinky_dip: 0.32,
                    pinky_splay: -0.08,

                    // Ngón cái (Thumb): Tự nhiên hướng nhẹ ra phía trước bên trái
                    thumb_opp: -0.20,  // Nghiêng tự nhiên sang bên trái (-X)
                    thumb_abd: 0.20,   // Mở nhẹ
                    thumb_mcp: 0.18,   // Gập nhẹ đốt 1
                    thumb_dip: 0.12    // Gập nhẹ đốt 2
                }
            },

            fist: {
                name: 'Nắm chặt',
                badgeClass: 'state-fist',
                icon: '✊',
                ledColor: 0xf59e0b, // Amber / Cam năng lượng
                angles: {
                    // 4 ngón tay gập cuộn chặt vào lòng bàn tay
                    // Ngón trỏ
                    index_mcp: 1.48,
                    index_pip: 1.62,
                    index_dip: 1.15,
                    index_splay: -0.02, // Khép nhẹ về phía trung tâm

                    // Ngón giữa
                    middle_mcp: 1.52,
                    middle_pip: 1.65,
                    middle_dip: 1.18,
                    middle_splay: 0.0,

                    // Ngón áp út
                    ring_mcp: 1.54,
                    ring_pip: 1.68,
                    ring_dip: 1.20,
                    ring_splay: 0.02, // Khép nhẹ về phía trung tâm

                    // Ngón út
                    pinky_mcp: 1.56,
                    pinky_pip: 1.70,
                    pinky_dip: 1.22,
                    pinky_splay: 0.04,

                    // Ngón cái khóa ôm chặt BÊN NGOÀI ngón trỏ và ngón giữa (Anatomical Fist Lock)
                    // Đốt 1 đi chếch lên dọc sườn ngón trỏ; đốt 2 gập ngang khóa đè lên ngón giữa
                    thumb_opp: 0.44,   // Đốt 1 nghiêng chếch lên ôm sườn ngón trỏ
                    thumb_abd: 0.02,   // Ép sát mặt trước
                    thumb_mcp: 0.45,   // Đẩy nổi ra mặt ngoài (+Z) để khóa đè bên ngoài các ngón
                    thumb_dip: 1.02    // Đốt 2 gập ngang khóa chắc chắn trên ngón giữa (~8° góc ngẩng tự nhiên)
                }
            },

            open: {
                name: 'Xòe tay',
                badgeClass: 'state-open',
                icon: '🖐️',
                ledColor: 0x10b981, // Emerald xanh lá sẵn sàng
                angles: {
                    // 5 ngón tay duỗi thẳng và tản rộng hình nan quạt (True Fan Abduction)
                    // Ngón trỏ tản mạnh sang trái (-X)
                    index_mcp: -0.05,
                    index_pip: 0.0,
                    index_dip: 0.0,
                    index_splay: 0.18,

                    // Ngón giữa trục trung tâm
                    middle_mcp: -0.05,
                    middle_pip: 0.0,
                    middle_dip: 0.0,
                    middle_splay: 0.0,

                    // Ngón áp út tản sang phải (+X)
                    ring_mcp: -0.05,
                    ring_pip: 0.0,
                    ring_dip: 0.0,
                    ring_splay: -0.16,

                    // Ngón út tản tối đa sang phải (+X)
                    pinky_mcp: -0.05,
                    pinky_pip: 0.0,
                    pinky_dip: 0.0,
                    pinky_splay: -0.32,

                    // Ngón cái mở rộng sang bên trái tối đa (True Thumb Abduction)
                    thumb_opp: -0.68,  // Tản rộng tối đa sang bên trái (-X)
                    thumb_abd: 0.25,   // Mở phẳng
                    thumb_mcp: -0.05,  // Duỗi thẳng
                    thumb_dip: 0.0     // Duỗi thẳng
                }
            }
        };

        this.initMaterials();
        this.buildHand();
    }

    initMaterials() {
        // 1. Aerospace Matte Carbon Fiber (Vỏ đen nhám công nghệ cao)
        this.matCarbon = new THREE.MeshStandardMaterial({
            color: 0x222832,
            roughness: 0.35,
            metalness: 0.30
        });

        // 2. High-Polished Aircraft Titanium (Khớp bản lề, ốc vít, viền kim loại)
        this.matTitanium = new THREE.MeshStandardMaterial({
            color: 0xdde6f2,
            roughness: 0.18,
            metalness: 0.92
        });

        // 3. Dark Industrial Anodized Alloy (Khung chịu lực bên trong)
        this.matDarkMetal = new THREE.MeshStandardMaterial({
            color: 0x141820,
            roughness: 0.42,
            metalness: 0.75
        });

        // 4. Accent Blue Pivot Bushings (Vòng đệm kim loại công nghệ)
        this.matAccentMetal = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.25,
            metalness: 0.82
        });

        // 5. Tactile Silicone Grip Pads (Đệm ma sát ngón tay & lòng bàn tay)
        this.matSilicone = new THREE.MeshStandardMaterial({
            color: 0x283344,
            roughness: 0.85,
            metalness: 0.08
        });

        // 6. Biometric LED Core & Wrist Status Ring
        this.matLed = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 2.8,
            roughness: 0.15,
            metalness: 0.1
        });
        this.ledMaterials.push(this.matLed);
    }

    buildHand() {
        // === 1. FOREARM BASE & WRIST (CỔ TAY VÀ CẰNG TAY CƠ KHÍ) ===
        const wristGroup = new THREE.Group();
        wristGroup.position.set(0, -0.62, 0);

        // Vỏ cẳng tay khí động học (Aerodynamic Forearm Socket)
        const forearmGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.55, 32);
        const forearmMesh = new THREE.Mesh(forearmGeo, this.matCarbon);
        forearmMesh.castShadow = true;
        forearmMesh.receiveShadow = true;
        wristGroup.add(forearmMesh);

        // Nẹp titanium dọc theo cẳng tay
        const strutForearmGeo = new THREE.BoxGeometry(0.015, 0.50, 0.05);
        const strut1 = new THREE.Mesh(strutForearmGeo, this.matTitanium);
        strut1.position.set(0.25, 0, 0);
        wristGroup.add(strut1);

        const strut2 = new THREE.Mesh(strutForearmGeo, this.matTitanium);
        strut2.position.set(-0.25, 0, 0);
        wristGroup.add(strut2);

        // Vòng LED trạng thái cổ tay (Glowing Wrist Status Ring)
        const wristRingGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.045, 32);
        const wristRingMesh = new THREE.Mesh(wristRingGeo, this.matLed);
        wristRingMesh.position.y = 0.20;
        wristGroup.add(wristRingMesh);

        // Vòng kẹp Titanium bảo vệ cổ tay
        const collarGeo = new THREE.CylinderGeometry(0.255, 0.255, 0.06, 32);
        const collarMesh = new THREE.Mesh(collarGeo, this.matTitanium);
        collarMesh.position.y = 0.26;
        collarMesh.castShadow = true;
        wristGroup.add(collarMesh);

        // Khớp bản lề cổ tay Titanium (Machined Wrist Gimbal)
        const wristGimbalGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 24);
        wristGimbalGeo.rotateZ(Math.PI / 2);
        const wristGimbal = new THREE.Mesh(wristGimbalGeo, this.matTitanium);
        wristGimbal.position.y = 0.33;
        wristGimbal.castShadow = true;
        wristGroup.add(wristGimbal);

        this.group.add(wristGroup);

        // === 2. PALM CHASSIS (KHUNG THÂN BÀN TAY BIONIC) ===
        const palmGroup = new THREE.Group();
        palmGroup.position.set(0, 0, 0);

        // Kích thước chuẩn giải phẫu học cánh tay cơ khí
        const palmWidthBottom = 0.44;
        const palmWidthTop = 0.56;
        const palmHeight = 0.62;
        const palmDepth = 0.18;

        const palmShape = new THREE.Shape();
        palmShape.moveTo(-palmWidthBottom / 2, -palmHeight / 2);
        palmShape.lineTo(palmWidthBottom / 2, -palmHeight / 2);
        palmShape.lineTo(palmWidthTop / 2, palmHeight / 2);
        palmShape.lineTo(-palmWidthTop / 2, palmHeight / 2);
        palmShape.closePath();

        const extrudeSettings = {
            depth: palmDepth,
            bevelEnabled: true,
            bevelSegments: 3,
            steps: 1,
            bevelSize: 0.025,
            bevelThickness: 0.025
        };

        const palmGeo = new THREE.ExtrudeGeometry(palmShape, extrudeSettings);
        palmGeo.center();
        const palmMesh = new THREE.Mesh(palmGeo, this.matCarbon);
        palmMesh.castShadow = true;
        palmMesh.receiveShadow = true;
        palmGroup.add(palmMesh);

        // Viền nẹp Titanium cạnh bên khung bàn tay
        const edgeTrimGeo = new THREE.BoxGeometry(0.016, palmHeight * 0.95, palmDepth * 0.9);
        const leftEdge = new THREE.Mesh(edgeTrimGeo, this.matTitanium);
        leftEdge.position.set(-palmWidthBottom / 2 - 0.03, 0, 0);
        leftEdge.rotation.z = -0.10;
        palmGroup.add(leftEdge);

        const rightEdge = new THREE.Mesh(edgeTrimGeo, this.matTitanium);
        rightEdge.position.set(palmWidthBottom / 2 + 0.03, 0, 0);
        rightEdge.rotation.z = 0.10;
        palmGroup.add(rightEdge);

        // Mặt trước (LÒNG BÀN TAY / PALMAR FACE ở +Z)
        const palmPad1Geo = new THREE.BoxGeometry(0.18, 0.24, 0.02);
        const palmPad1 = new THREE.Mesh(palmPad1Geo, this.matSilicone);
        palmPad1.position.set(-0.11, -0.05, 0.105);
        palmGroup.add(palmPad1);

        const palmPad2Geo = new THREE.BoxGeometry(0.18, 0.24, 0.02);
        const palmPad2 = new THREE.Mesh(palmPad2Geo, this.matSilicone);
        palmPad2.position.set(0.11, -0.05, 0.105);
        palmGroup.add(palmPad2);

        // Dải LED trạng thái mặt trước lòng bàn tay (Front Biometric Indicator)
        const frontLedGeo = new THREE.BoxGeometry(0.015, 0.28, 0.01);
        const frontLed = new THREE.Mesh(frontLedGeo, this.matLed);
        frontLed.position.set(0, -0.05, 0.115);
        palmGroup.add(frontLed);

        // Mặt sau (MU BÀN TAY / DORSAL FACE ở -Z)
        const dorsalPlateGeo = new THREE.BoxGeometry(0.44, 0.46, 0.025);
        const dorsalPlateMesh = new THREE.Mesh(dorsalPlateGeo, this.matDarkMetal);
        dorsalPlateMesh.position.set(0, 0.02, -0.105);
        dorsalPlateMesh.castShadow = true;
        palmGroup.add(dorsalPlateMesh);

        // Lõi Biometric AI Core phát sáng mu bàn tay
        const coreGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.015, 6);
        coreGeo.rotateX(Math.PI / 2);
        const coreMesh = new THREE.Mesh(coreGeo, this.matLed);
        coreMesh.position.set(0, 0.04, -0.12);
        palmGroup.add(coreMesh);

        const coreBezelGeo = new THREE.RingGeometry(0.065, 0.09, 6);
        const coreBezelMesh = new THREE.Mesh(coreBezelGeo, this.matTitanium);
        coreBezelMesh.position.set(0, 0.04, -0.125);
        palmGroup.add(coreBezelMesh);

        this.group.add(palmGroup);

        // === 3. ARTICULATED 4 FINGERS (TRỎ, GIỮA, ÁP ÚT, ÚT) ===
        const fingerConfigs = [
            { id: 'index',  name: 'Trỏ',   x: -0.19, len1: 0.30, len2: 0.20, len3: 0.17, rad: 0.038 },
            { id: 'middle', name: 'Giữa',  x: -0.06, len1: 0.34, len2: 0.22, len3: 0.19, rad: 0.040 },
            { id: 'ring',   name: 'Áp út', x:  0.07, len1: 0.30, len2: 0.20, len3: 0.17, rad: 0.038 },
            { id: 'pinky',  name: 'Út',    x:  0.19, len1: 0.24, len2: 0.16, len3: 0.14, rad: 0.033 }
        ];

        fingerConfigs.forEach(cfg => {
            this.buildStandardFinger(cfg, palmGroup, palmHeight / 2);
        });

        // === 4. ARTICULATED THUMB (NGÓN CÁI ĐA HƯỚNG) ===
        this.buildThumb(palmGroup);

        // Khởi tạo các góc quay mục tiêu ban đầu
        for (const [poseKey, poseData] of Object.entries(this.poses)) {
            for (const [jointName, angle] of Object.entries(poseData.angles)) {
                if (this.currentAngles[jointName] === undefined) {
                    this.currentAngles[jointName] = angle;
                    this.targetAngles[jointName] = angle;
                }
            }
        }

        this.isLoaded = true;
        this.setPose('relax', true);
    }

    /**
     * Dựng 1 ngón tay 3 đốt cơ khí với khớp bản lề Titanium
     */
    buildStandardFinger(cfg, parent, knuckleBaseY) {
        // 1. Khớp tản ngang (Splay Hinge)
        const splayGroup = new THREE.Group();
        splayGroup.position.set(cfg.x, knuckleBaseY, 0);
        parent.add(splayGroup);
        this.joints[`${cfg.id}_splay`] = splayGroup;

        // 2. Khớp gốc ngón tay (MCP Joint)
        const mcpHinge = new THREE.Group();
        splayGroup.add(mcpHinge);
        this.joints[`${cfg.id}_mcp`] = mcpHinge;

        // Cục khớp bản lề MCP (Titanium Hinge Pin)
        const knuckleCylGeo = new THREE.CylinderGeometry(cfg.rad * 1.05, cfg.rad * 1.05, cfg.rad * 2.2, 16);
        knuckleCylGeo.rotateZ(Math.PI / 2);
        const knuckleMesh = new THREE.Mesh(knuckleCylGeo, this.matTitanium);
        knuckleMesh.castShadow = true;
        mcpHinge.add(knuckleMesh);

        // Đốt 1: Proximal Phalanx
        const p1 = this.createPhalanxSegment(cfg.len1, cfg.rad, true);
        p1.position.y = cfg.len1 / 2;
        mcpHinge.add(p1);

        // 3. Khớp giữa (PIP Joint)
        const pipHinge = new THREE.Group();
        pipHinge.position.set(0, cfg.len1, 0);
        mcpHinge.add(pipHinge);
        this.joints[`${cfg.id}_pip`] = pipHinge;

        const pipCylGeo = new THREE.CylinderGeometry(cfg.rad * 0.92, cfg.rad * 0.92, cfg.rad * 2.0, 16);
        pipCylGeo.rotateZ(Math.PI / 2);
        const pipMesh = new THREE.Mesh(pipCylGeo, this.matTitanium);
        pipMesh.castShadow = true;
        pipHinge.add(pipMesh);

        // Đốt 2: Intermediate Phalanx
        const p2 = this.createPhalanxSegment(cfg.len2, cfg.rad * 0.85, false);
        p2.position.y = cfg.len2 / 2;
        pipHinge.add(p2);

        // 4. Khớp ngọn (DIP Joint)
        const dipHinge = new THREE.Group();
        dipHinge.position.set(0, cfg.len2, 0);
        pipHinge.add(dipHinge);
        this.joints[`${cfg.id}_dip`] = dipHinge;

        const dipCylGeo = new THREE.CylinderGeometry(cfg.rad * 0.78, cfg.rad * 0.78, cfg.rad * 1.8, 16);
        dipCylGeo.rotateZ(Math.PI / 2);
        const dipMesh = new THREE.Mesh(dipCylGeo, this.matTitanium);
        dipMesh.castShadow = true;
        dipHinge.add(dipMesh);

        // Đốt 3: Distal Phalanx & Fingertip Tactile Pad
        const p3 = this.createFingertipSegment(cfg.len3, cfg.rad * 0.72);
        p3.position.y = cfg.len3 / 2;
        dipHinge.add(p3);
    }

    /**
     * Dựng ngón cái (Thumb)
     */
    buildThumb(parent) {
        // === KHỐI GÒ NGÓN CÁI BIONIC (THENAR HOUSING & SERVO BRACKET) ===
        // Kết nối liền mạch từ khung thân bàn tay (z ~ 0.09) ra bệ đỡ ngón cái (z ~ 0.28)
        const thenarGroup = new THREE.Group();

        // 1. Khối đệm gò thenar Carbon Fiber vát khí động học
        const thenarShape = new THREE.Shape();
        thenarShape.moveTo(-0.25, -0.14); // Đáy dưới tiếp giáp sườn bàn tay
        thenarShape.lineTo(-0.13, -0.12); // Mặt trong lòng bàn tay
        thenarShape.lineTo(-0.16, 0.05);  // Đỉnh trên mặt trong (dưới gốc ngón trỏ)
        thenarShape.lineTo(-0.25, 0.05);  // Đỉnh trên sườn ngoài
        thenarShape.closePath();

        const thenarExtrudeSettings = {
            depth: 0.18,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.015,
            bevelThickness: 0.015
        };

        const thenarGeo = new THREE.ExtrudeGeometry(thenarShape, thenarExtrudeSettings);
        const thenarMesh = new THREE.Mesh(thenarGeo, this.matCarbon);
        thenarMesh.position.set(0, 0, 0.08); // Bắt đầu từ mặt trước thân bàn tay (0.08) tới (0.26)
        thenarMesh.rotation.x = -0.10;
        thenarMesh.castShadow = true;
        thenarMesh.receiveShadow = true;
        thenarGroup.add(thenarMesh);

        // 2. Nẹp sườn Titanium chịu lực nối từ viền bàn tay ra gốc ngón cái
        const strutThenarGeo = new THREE.BoxGeometry(0.018, 0.19, 0.04);
        const strutThenar = new THREE.Mesh(strutThenarGeo, this.matTitanium);
        strutThenar.position.set(-0.255, -0.03, 0.17);
        strutThenar.rotation.set(-0.45, 0, 0.08);
        strutThenar.castShadow = true;
        thenarGroup.add(strutThenar);

        // 3. Vòng đệm kim loại ôm cổ trục servo ngón cái (Servo Gimbal Collar)
        const servoCollarGeo = new THREE.CylinderGeometry(0.050, 0.056, 0.035, 20);
        servoCollarGeo.rotateX(Math.PI / 2);
        const servoCollar = new THREE.Mesh(servoCollarGeo, this.matDarkMetal);
        servoCollar.position.set(-0.24, 0.04, 0.24);
        servoCollar.castShadow = true;
        thenarGroup.add(servoCollar);

        parent.add(thenarGroup);

        // Gốc thenar mount gắn ở cạnh trước-trái của lòng bàn tay (nổi ra phía trước để khóa bên ngoài 4 ngón)
        const thumbBase = new THREE.Group();
        thumbBase.position.set(-0.24, 0.04, 0.28);
        thumbBase.rotation.set(0.06, 0.10, 0);
        parent.add(thumbBase);

        // 1. Opposition Hinge (Quay quanh trục Z nghiêng sang phải/trái)
        const oppHinge = new THREE.Group();
        thumbBase.add(oppHinge);
        this.joints['thumb_opp'] = oppHinge;

        const oppCylGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.075, 16);
        oppCylGeo.rotateX(Math.PI / 2);
        const oppMesh = new THREE.Mesh(oppCylGeo, this.matTitanium);
        oppHinge.add(oppMesh);

        const oppPivotGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.080, 16);
        oppPivotGeo.rotateX(Math.PI / 2);
        const oppPivot = new THREE.Mesh(oppPivotGeo, this.matAccentMetal);
        oppHinge.add(oppPivot);

        // 2. Abduction Hinge (Mở sang bên trái)
        const abdHinge = new THREE.Group();
        oppHinge.add(abdHinge);
        this.joints['thumb_abd'] = abdHinge;

        // 3. Khớp MCP ngón cái (Gập quanh trục X tiến về +Z)
        const mcpHinge = new THREE.Group();
        abdHinge.add(mcpHinge);
        this.joints['thumb_mcp'] = mcpHinge;

        const knuckleGeo = new THREE.CylinderGeometry(0.040, 0.040, 0.08, 16);
        knuckleGeo.rotateZ(Math.PI / 2);
        const knuckleMesh = new THREE.Mesh(knuckleGeo, this.matTitanium);
        mcpHinge.add(knuckleMesh);

        // Đốt 1 ngón cái
        const thumbLen1 = 0.22;
        const p1 = this.createPhalanxSegment(thumbLen1, 0.044, true);
        p1.position.y = thumbLen1 / 2;
        mcpHinge.add(p1);

        // Khớp DIP ngón cái
        const dipHinge = new THREE.Group();
        dipHinge.position.set(0, thumbLen1, 0);
        mcpHinge.add(dipHinge);
        this.joints['thumb_dip'] = dipHinge;

        const dipCylGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.070, 16);
        dipCylGeo.rotateX(Math.PI / 2);
        const dipMesh = new THREE.Mesh(dipCylGeo, this.matTitanium);
        dipHinge.add(dipMesh);

        const dipPivotGeo = new THREE.CylinderGeometry(0.020, 0.020, 0.075, 16);
        dipPivotGeo.rotateX(Math.PI / 2);
        const dipPivot = new THREE.Mesh(dipPivotGeo, this.matAccentMetal);
        dipHinge.add(dipPivot);

        // Đốt 2 ngón cái & đệm cảm biến
        const thumbLen2 = 0.18;
        const p2 = this.createFingertipSegment(thumbLen2, 0.040);
        p2.position.y = thumbLen2 / 2;
        dipHinge.add(p2);
    }

    /**
     * Tạo phân đoạn đốt ngón tay cơ khí (Carbon Fiber Chassis + Titanium Side Struts)
     */
    createPhalanxSegment(length, radius, hasActuatorRod = true) {
        const segGroup = new THREE.Group();

        // Thân đốt Carbon Fiber
        const bodyGeo = new THREE.BoxGeometry(radius * 1.8, length * 0.90, radius * 1.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, this.matCarbon);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        segGroup.add(bodyMesh);

        // Nẹp trợ lực Titanium bên sườn (Bionic Side Struts)
        const strutGeo = new THREE.BoxGeometry(0.012, length * 0.85, radius * 0.8);
        const strutLeft = new THREE.Mesh(strutGeo, this.matTitanium);
        strutLeft.position.set(-radius * 0.95, 0, 0);
        segGroup.add(strutLeft);

        const strutRight = new THREE.Mesh(strutGeo, this.matTitanium);
        strutRight.position.set(radius * 0.95, 0, 0);
        segGroup.add(strutRight);

        // Thanh đẩy servo cơ học (Actuator Rod) ở mặt ngoài (-Z)
        if (hasActuatorRod) {
            const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, length * 0.75, 8);
            const rodMesh = new THREE.Mesh(rodGeo, this.matAccentMetal);
            rodMesh.position.set(0, 0, -radius * 0.65);
            segGroup.add(rodMesh);
        }

        return segGroup;
    }

    /**
     * Tạo đầu ngón tay với đệm cảm ứng silicone ma sát cao ở mặt trong (+Z)
     */
    createFingertipSegment(length, radius) {
        const tipGroup = new THREE.Group();

        // Phần vỏ bo tròn
        const tipGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.92, length * 0.88, 16);
        const tipMesh = new THREE.Mesh(tipGeo, this.matCarbon);
        tipMesh.castShadow = true;
        tipGroup.add(tipMesh);

        // Đệm cao su silicon ma sát cao ở mặt trong (+Z hướng lòng bàn tay)
        const padGeo = new THREE.BoxGeometry(radius * 1.4, length * 0.70, radius * 0.35);
        const padMesh = new THREE.Mesh(padGeo, this.matSilicone);
        padMesh.position.set(0, -length * 0.05, radius * 0.65);
        tipGroup.add(padMesh);

        // Đèn LED cảm biến tiếp xúc ở đầu móng (-Z)
        const ledDotGeo = new THREE.SphereGeometry(radius * 0.25, 8, 8);
        const ledDotMesh = new THREE.Mesh(ledDotGeo, this.matLed);
        ledDotMesh.position.set(0, length * 0.38, -radius * 0.32);
        tipGroup.add(ledDotMesh);

        return tipGroup;
    }

    /**
     * Tải mô hình vào Three.js scene
     */
    load(scene, onProgress, onComplete) {
        // Căn chỉnh vị trí và tỷ lệ chuẩn
        this.group.scale.set(1.05, 1.05, 1.05);
        this.group.position.set(0, -0.08, 0);

        // Góc nhìn 3/4 thẩm mỹ công nghệ cao: nhìn rõ cả lòng bàn tay, các ngón tay và sườn cơ khí
        this.group.rotation.set(0.10, -0.18, 0);

        scene.add(this.group);

        if (onComplete) onComplete(this);
    }

    /**
     * Đặt tư thế bàn tay ('relax' | 'fist' | 'open')
     */
    setPose(poseName, immediate = false) {
        if (!this.poses[poseName]) return;

        this.currentPose = poseName;
        const poseData = this.poses[poseName];

        for (const [jointName, angle] of Object.entries(poseData.angles)) {
            this.targetAngles[jointName] = angle;
            if (immediate) {
                this.currentAngles[jointName] = angle;
                this.applyAngle(jointName, angle);
            }
        }

        // Cập nhật màu đèn LED theo trạng thái
        if (poseData.ledColor) {
            this.ledMaterials.forEach(mat => {
                mat.color.setHex(poseData.ledColor);
                mat.emissive.setHex(poseData.ledColor);
            });
        }
    }

    /**
     * Áp dụng góc xoay cơ học
     */
    applyAngle(jointName, angle) {
        const joint = this.joints[jointName];
        if (!joint) return;

        if (jointName.endsWith('_splay')) {
            // Tản ngang quanh trục Z (Dương: nghiêng trái, Âm: nghiêng phải)
            joint.rotation.z = angle;
        } else if (jointName === 'thumb_opp') {
            // Đối ngón cái: xoay nghiêng sang phải (+X) ôm sườn ngón trỏ
            joint.rotation.z = -angle;
        } else if (jointName === 'thumb_abd') {
            // Mở ngón cái tản sang bên trái
            joint.rotation.y = angle;
        } else if (jointName === 'thumb_dip') {
            // Khớp liên đốt ngón cái: xoay gập ngang quanh Z để ôm qua ngón giữa
            joint.rotation.z = -angle;
            joint.rotation.x = 0.18; // Khép nhẹ ôm vào mặt trước ngón giữa
        } else {
            // Gập về phía trước (+Z lòng bàn tay) quanh trục X
            joint.rotation.x = angle;
        }
    }

    /**
     * Cập nhật chuyển động nội suy LERP mượt mà
     */
    update(deltaTime) {
        if (!this.isLoaded) return;

        const t = Math.min(1.0, deltaTime * this.transitionSpeed);

        for (const [name, targetAngle] of Object.entries(this.targetAngles)) {
            const currentAngle = this.currentAngles[name];
            const newAngle = THREE.MathUtils.lerp(currentAngle, targetAngle, t);
            this.currentAngles[name] = newAngle;
            this.applyAngle(name, newAngle);
        }
    }

    getCurrentPose() {
        return this.currentPose;
    }

    getPoseInfo(poseName) {
        return this.poses[poseName || this.currentPose];
    }
}
