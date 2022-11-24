import {
  AmbientLight,
  Animator,
  AnimatorStateMachine,
  AssetType,
  BackgroundMode,
  Camera,
  DirectLight,
  Engine,
  GLTFResource,
  Material,
  PBRMaterial,
  PrimitiveMesh,
  SkyBoxMaterial,
  Texture2D,
  Vector3,
  WebGLEngine,
  AnimatorController,
  AnimatorControllerLayer,
  Script,
  StaticCollider,
  BoxColliderShape,
  DynamicCollider,
  PlaneColliderShape,
  Ray,
  Vector2,
  Entity,
  Plane,
  MathUtil,
  WrapMode,
} from "oasis-engine";
import TWEEN from "@tweenjs/tween.js";
import { PhysXPhysics } from "@oasis-engine/physics-physx";

// 金币旋转
class CoinScript extends Script {
  private _angle = 0;
  constructor(entity: Entity) {
    super(entity);
  }
  onTriggerEnter() {
    // 金币消失
    new TWEEN.Tween(this.entity.transform.scale)
      .to({ x: 1, y: 1, z: 1 }, 500)
      .chain(
        new TWEEN.Tween(this.entity.transform.scale)
          .to({ x: 0.2, y: 0.2, z: 0.2 }, 300)
          .easing(TWEEN.Easing.Back.In)
          .onComplete(() => {
            this.entity.isActive = false;
          })
      )
      .start();
  }
  onUpdate() {
    this._angle += 5;
    this.entity.transform.setRotation(0, this._angle, 0);
  }
}

class HeroScript extends Script {
  private _runningSpeed: number = 0.002;
  private _camera: Camera;
  private _ray: Ray = new Ray();
  private _targetPoint: Vector3 = new Vector3();
  private _rotateDegree: number = 0;
  private _runningDist: number = 0;

  private _curDir: Vector3 = new Vector3();
  private _targetDir: Vector3 = new Vector3();
  private _tempVec: Vector3 = new Vector3();
  private _upVec: Vector3 = new Vector3(0, 1, 0);
  private _runningTween: any;

  constructor(entity: Entity) {
    super(entity);
    this._camera = entity.parent.findByName("camera").getComponent(Camera);
    // 地面
    const plane = new Plane(this._upVec);

    document.addEventListener("click", (e) => {
      const ratio = window.devicePixelRatio;
      this._camera.screenPointToRay(
        new Vector2(e.offsetX, e.offsetY).scale(ratio),
        this._ray
      );
      const tempDist = this._ray.intersectPlane(plane);
      this._ray.getPoint(tempDist, this._targetPoint);

      // 转头
      this._caculateRotation();
      this.entity.transform.rotate(0, this._rotateDegree, 0);
      // 移动
      this._runningTween = new TWEEN.Tween(this.entity.transform.position)
        .to(
          {
            x: this._targetPoint.x,
            y: this._targetPoint.y,
            z: this._targetPoint.z,
          },
          this._runningDist / this._runningSpeed
        )
        .onStart(() => {
          animatorHero.play(State.Run);
        })
        .onComplete(() => {
          animatorHero.play(State.Idle);
        })
        .start();
    });
  }

  private _caculateRotation() {
    this.entity.transform.getWorldForward(this._curDir);
    Vector3.subtract(
      this._targetPoint,
      this.entity.transform.position,
      this._targetDir
    );
    this._runningDist = this._targetDir.length();
    this._targetDir.normalize();

    Vector3.cross(this._curDir, this._targetDir, this._tempVec);
    const direction = Vector3.dot(this._tempVec, this._upVec);

    const radian =
      Math.sign(direction) *
      Math.acos(Vector3.dot(this._curDir, this._targetDir));
    this._rotateDegree = MathUtil.radianToDegree(radian) - 180;
  }

  onTriggerEnter() {
    TWEEN.remove(this._runningTween);

    this._runningTween = new TWEEN.Tween(this.entity.transform.position)
      .to({}, 450)
      .onStart(() => {
        animatorHero.crossFade(State.Jump, 1);
      })
      .onComplete(() => {
        animatorHero.crossFade(State.Idle, 0.5);
      })
      .start();
  }

  onUpdate() {
    TWEEN.update();
  }
}

enum State {
  Run = "Run",
  Idle = "Idle",
  Jump = "Jump_In",
}

let animatorHero: Animator;

PhysXPhysics.initialize().then(() => {
  const engine = new WebGLEngine("canvas");
  engine.physicsManager.initialize(PhysXPhysics);
  engine.canvas.resizeByClientSize();

  // 添加天空盒
  const scene = engine.sceneManager.activeScene;
  scene.background.mode = BackgroundMode.Sky;
  const sky = scene.background.sky;
  const skyMaterial = new SkyBoxMaterial(engine);
  sky.material = skyMaterial;
  sky.mesh = PrimitiveMesh.createCuboid(engine, 1, 1, 1);

  const rootEntity = scene.createRootEntity();

  // 添加相机
  const cameraEntity = rootEntity.createChild("camera");
  const camera = cameraEntity.addComponent(Camera);
  cameraEntity.transform.setPosition(14, 5, 7);
  cameraEntity.transform.lookAt(new Vector3(0, 0, 0));

  // 添加方向光
  const lightEntity = rootEntity.createChild("Light");
  lightEntity.transform.setRotation(-30, 0, 0);
  lightEntity.addComponent(DirectLight);

  // 地面
  const groundEntity = rootEntity.createChild("ground");
  const physicsPlane = new PlaneColliderShape();
  const planeCollider = groundEntity.addComponent(StaticCollider);
  planeCollider.addShape(physicsPlane);

  // 金币
  const coinEntity = rootEntity.createChild("coin");
  coinEntity.transform.setPosition(7.5, 1.5, 3);
  coinEntity.transform.setScale(0.5, 0.5, 0.5);
  coinEntity.addComponent(CoinScript);

  const coinCollider = coinEntity.addComponent(StaticCollider);
  const coinBox = new BoxColliderShape();
  coinBox.size = new Vector3(1, 5, 1);
  coinBox.isTrigger = true;
  coinCollider.addShape(coinBox);

  // 主角
  const heroEntity = rootEntity.createChild("hero");
  heroEntity.transform.setPosition(5, 0, 0);
  heroEntity.transform.setRotation(0, 45, 0);
  heroEntity.transform.setScale(2, 2, 2);
  heroEntity.addComponent(HeroScript);

  const heroCollider = heroEntity.addComponent(DynamicCollider);
  heroCollider.isKinematic = true;
  const physicsBox = new BoxColliderShape();
  physicsBox.size = new Vector3(1, 5, 1);
  heroCollider.addShape(physicsBox);

  function textureAndAnimationLoader(
    engine: Engine,
    materials: Material[],
    animator: Animator,
    animatorStateMachine: AnimatorStateMachine
  ) {
    engine.resourceManager
      .load<Texture2D>(
        "https://gw.alipayobjects.com/zos/OasisHub/440001585/6990/T_Doggy_1_diffuse.png"
      )
      .then((res) => {
        for (let i = 0, n = materials.length; i < n; i++) {
          const material = materials[i];
          (<PBRMaterial>material).baseTexture = res;
        }
      });
    engine.resourceManager
      .load<Texture2D>(
        "https://gw.alipayobjects.com/zos/OasisHub/440001585/3072/T_Doggy_normal.png"
      )
      .then((res) => {
        for (let i = 0, n = materials.length; i < n; i++) {
          const material = materials[i];
          (<PBRMaterial>material).normalTexture = res;
        }
      });
    engine.resourceManager
      .load<Texture2D>(
        "https://gw.alipayobjects.com/zos/OasisHub/440001585/5917/T_Doggy_roughness.png"
      )
      .then((res) => {
        for (let i = 0, n = materials.length; i < n; i++) {
          const material = materials[i];
          (<PBRMaterial>material).roughnessMetallicTexture = res;
        }
      });
    engine.resourceManager
      .load<Texture2D>(
        "https://gw.alipayobjects.com/zos/OasisHub/440001585/2547/T_Doggy_1_ao.png"
      )
      .then((res) => {
        for (let i = 0, n = materials.length; i < n; i++) {
          const material = materials[i];
          (<PBRMaterial>material).occlusionTexture = res;
        }
      });
    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/440001585/7205/Anim_Run.gltf"
      )
      .then((res) => {
        const animations = res.animations;
        if (animations) {
          animations.forEach((clip: AnimationClip) => {
            const animatorState = animatorStateMachine.addState(clip.name);
            animatorState.clip = clip;
          });
        }
      });
    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/440001585/3380/Anim_Idle.gltf"
      )
      .then((res) => {
        const animations = res.animations;
        if (animations) {
          animations.forEach((clip: AnimationClip) => {
            const animatorState = animatorStateMachine.addState(clip.name);
            animatorState.clip = clip;
          });
          animator.play(State.Idle);
        }
      });

    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/440001585/2749/Anim_Jump_In.gltf"
      )
      .then((res) => {
        const animations = res.animations;
        if (animations) {
          animations.forEach((clip: AnimationClip) => {
            const animatorState = animatorStateMachine.addState(clip.name);
            animatorState.clip = clip;
            animatorState.wrapMode = WrapMode.ONCE;
          });
        }
      });
  }

  Promise.all([
    // 中间场景
    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/34156c78-ed78-4792-a027-f6b790ac5bd1/oasis-file/1664436920180/medieval_fantasy_tavern.gltf"
      )
      .then((gltf) => {
        const { defaultSceneRoot } = gltf;
        rootEntity.addChild(defaultSceneRoot);

        // 播放场景默认动画
        const animator = defaultSceneRoot.getComponent(Animator);
        animator.play("Fireflies|Fireflies");
      }),

    // 金币
    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/be5d38e9-f20d-4ebe-bfb2-4d07b9d9fdb8/oasis-file/1666778176802/stylized_coin.gltf"
      )
      .then((gltf) => {
        const { defaultSceneRoot } = gltf;
        coinEntity.addChild(defaultSceneRoot);
      }),

    // 主角
    engine.resourceManager
      .load<GLTFResource>(
        "https://gw.alipayobjects.com/os/OasisHub/440001585/5407/Doggy_Demo.gltf"
      )
      .then((asset) => {
        const { defaultSceneRoot } = asset;
        heroEntity.addChild(defaultSceneRoot);

        // animator
        animatorHero = defaultSceneRoot.addComponent(Animator);
        const animatorController = new AnimatorController();
        const layer = new AnimatorControllerLayer("layer");
        const animatorStateMachine = new AnimatorStateMachine();
        animatorController.addLayer(layer);
        animatorHero.animatorController = animatorController;
        layer.stateMachine = animatorStateMachine;

        textureAndAnimationLoader(
          engine,
          asset.materials,
          animatorHero,
          animatorStateMachine
        );
      }),

    // 背景hdr
    engine.resourceManager
      .load<AmbientLight>({
        type: AssetType.Env,
        url: "https://gw.alipayobjects.com/os/OasisHub/ec65f327-f43c-4d57-87ac-d90d102bbef4/oasis-file/1668050088855/gradient_005.hdr",
      })
      .then((ambientLight) => {
        scene.ambientLight = ambientLight;
        skyMaterial.textureCubeMap = ambientLight.specularTexture;
        skyMaterial.textureDecodeRGBM = true;
      }),
  ]).then(() => {
    engine.run();
  });
});
