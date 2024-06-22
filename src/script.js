import "./style.css";
import "bootstrap";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { ObjectControls } from "./orbitcontrols";
import TextTexture from "@seregpie/three.text-texture";
import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2";
import html2canvas from "html2canvas";

/**
 * Variables used in a 3D modeling application for managing selected background, color, model,
 * object controls, movement status, selected decal image, image scale, font scale, print size text,
 * decal mesh, t-shirt colors, bounding box, drag status, and scale.
 */

let selectedBg,
  selectedColor,
  selectedModel,
  objectControls,
  moved,
  selectedDecalImg;
let selectedDecal = null;
let imageScale = 1;
let fontScaleGlobal = 0.1;
let printSizeTxt = "";
let decalMesh = [];
let tshirtsColors = JSON.parse(tshirtsColorsList);
const box3 = new THREE.Box3();
let drag = false;
let scale = 1;
let settingsTemplate,
  TextListTemplate,
  preLoadingImg,
  preLoadingGif,
  backgroundPreview,
  settingLayoutUI,
  fontList,
  meshParam,
  bgjson,
  rotationStep;

let decalImageMap = new Map();
let decalTextMap = new Map();

let lockImg = "./icons/lock.png";
let unlockImg = "./icons/unlock.png";
let bg = [];
let renderer;
let width = 600;
let height = 600;

let fov = 35;
let mesh;
let raycaster, raycasterMesh;
const intersects = [];

let intersection = {
  intersects: false,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  rotation: new THREE.Vector3(),
};
let mouse = new THREE.Vector2();

let textureLoader = new THREE.TextureLoader();

let decals = [];
let mouseHelper;
const position = new THREE.Vector3();
const orientation = new THREE.Euler();
const size = new THREE.Vector3(1, 1, 1);

/**
 * Require the Handlebars templates for settings design and text list design.
 * @const {settingsTemplate} settingsTemplate - The Handlebars template for settings design.
 * @const {TextListTemplate} TextListTemplate - The Handlebars template for text list design.
 */
settingsTemplate = require("./template/settings.handlebars");
TextListTemplate = require("./template/TextList.handlebars");

preLoadingImg = document.getElementById("loadingImg");
preLoadingGif = document.getElementById("LoadingGif");
preLoadingImg.setAttribute("src", serverurl + "assets/loading.gif");

backgroundPreview = document.getElementById("backgroundPreview");
settingLayoutUI = document.getElementById("settingsPanel");

/**
 * Creates a new FontFace object for the Montserrat-Regular font.
 * @param {string} "Montserrat-Regular" - The name of the font.
 * @param {string} "url(./print_fonts/Montserrat/static/Montserrat-Regular.ttf)" - The URL of the font file.
 */
const Montserratfont = new FontFace(
  "Montserrat-Regular",
  "url(./print_fonts/Montserrat/static/Montserrat-Regular.ttf)"
);

/**
 * Represents a custom font face named "SixCaps-Regular" with the provided font URL.
 * @param {string} "SixCaps-Regular" - The name of the font face.
 * @param {string} "url(./print_fonts/SixCaps-Regular.ttf)" - The URL of the font file.
 */
const SixCapsfont = new FontFace(
  "SixCaps-Regular",
  "url(./print_fonts/SixCaps-Regular.ttf)"
);

/**
 * Represents a custom font face for the Condiment-Regular font.
 * @param {string} "Condiment-Regular" - The name of the font face.
 * @param {string} "url(./print_fonts/Condiment-Regular.ttf)" - The URL of the font file.
 */
const Condimentfont = new FontFace(
  "Condiment-Regular",
  "url(./print_fonts/Condiment-Regular.ttf)"
);

fontList = [Montserratfont, SixCapsfont, Condimentfont];

Handlebars.registerHelper("ifCond", function (v1, v2, options) {
  if (v1 === v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

/**
 * Assigns the first color from the array of t-shirt colors.
 */
selectedColor = tshirtsColors[0];

bgjson = JSON.parse(backgroundImageList);
bg = bgjson.background;
selectedBg = bg[0];
backgroundPreview.style.backgroundImage = "url(" + selectedBg.url + ")";

meshParam = {
  slide: "slide",
  amblight: 1.5,
  image: {
    width: 600,
    height: 500,
  },
  scale: 1,
  rotation: 0,
  isNew: false,
  rotationEnable: true,
  uploadImage: false,
  upload: function () {
    fileupload();
  },
};

/**
 * Converts degrees to radians using the THREE.js MathUtils.degToRad method.
 * @param {number} value - The value in degrees to convert to radians.
 * @returns The converted value in radians.
 */
function degtorad(value) {
  return THREE.MathUtils.degToRad(value);
}

rotationStep = degtorad(90);

/**
 * Retrieves the first canvas element with the class "webgl" using document.querySelector.
 * @returns The canvas element with the class "webgl", or null if not found.
 */
const canvas = document.querySelector("canvas.webgl");

/**
 * Creates a new Three.js scene.
 * @returns {THREE.Scene} A new Three.js scene object.
 */
const scene = new THREE.Scene();

/**
 * Creates a new Hemisphere Light with the given sky color, ground color, and intensity,
 * and adds it to the scene.
 * @param {number} skyColor - The color of the sky in hexadecimal format.
 * @param {number} groundColor - The color of the ground in hexadecimal format.
 * @param {number} intensity - The intensity of the light.
 */
const hemisphereLight = new THREE.HemisphereLight(
  0xfdf3c6,
  0xeed5ae,
  meshParam.amblight
);
scene.add(hemisphereLight);

/**
 * Initializes two instances of the Raycaster class from the THREE.js library.
 */
raycaster = new THREE.Raycaster();
raycasterMesh = new THREE.Raycaster();

/**
 * Creates a mouse helper object in a Three.js scene to assist with mouse interactions.
 * @param {Object} meshParam - Parameters for the mesh (e.g., scale).
 * @param {THREE.Scene} scene - The Three.js scene where the mouse helper will be added.
 */
mouseHelper = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    wireframe: false,
  })
);
mouseHelper.visible = false;

/**
 * Creates a box helper for the given object to visually represent its bounding box.
 */
const mouseHelperbox = new THREE.BoxHelper(mouseHelper, 0xffff00);
mouseHelper.renderOrder = -1;
mouseHelper.add(mouseHelperbox);

mouseHelper.scale.set(meshParam.scale, meshParam.scale, 0.1);
mouseHelper.rotation.set(0, 0, 0);
scene.add(mouseHelper);

/**
 * Defines an object containing width and height properties based on the window size.
 */
let sizes = {
  width: window.innerWidth > 767 ? width : window.innerWidth,
  height: window.innerWidth > 767 ? height : window.innerHeight * 0.5,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth > 767 ? width : window.innerWidth;
  sizes.height = window.innerWidth > 767 ? height : window.innerHeight * 0.5;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  fov,
  sizes.width / sizes.height,
  1,
  10000
);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 160;
scene.add(camera);

/**
 * Creates a new instance of THREE.LoadingManager for managing the loading of external resources.
 * @type {THREE.LoadingManager}
 */
const manager = new THREE.LoadingManager();

/**
 * Function that is called when the manager starts loading a file.
 * @param {string} url - The URL of the file being loaded.
 * @param {number} itemsLoaded - The number of items that have been loaded so far.
 * @param {number} itemsTotal - The total number of items to be loaded.
 */
manager.onStart = function (url, itemsLoaded, itemsTotal) {
  console.log(
    "Started loading file: " +
      url +
      ".\nLoaded " +
      itemsLoaded +
      " of " +
      itemsTotal +
      " files."
  );
};

/**
 * Function to handle actions when the manager has finished loading.
 * Hides the preLoadingGif element and logs a message to the console.
 */
manager.onLoad = function () {
  preLoadingGif.classList.add("hide");
  console.log("Loading complete!");
};

/**
 * Callback function that logs the progress of loading files.
 * @param {string} url - The URL of the file being loaded.
 * @param {number} itemsLoaded - The number of items loaded.
 * @param {number} itemsTotal - The total number of items to load.
 */
manager.onProgress = function (url, itemsLoaded, itemsTotal) {
  console.log(
    "Loading file: " +
      url +
      ".\nLoaded " +
      itemsLoaded +
      " of " +
      itemsTotal +
      " files."
  );
};

/**
 * Callback function that logs an error message when a specified URL fails to load.
 * @param {string} url - The URL that failed to load.
 */
manager.onError = function (url) {
  console.log("There was an error loading " + url);
};

const loader = new GLTFLoader(manager);
const dracoLoader = new DRACOLoader();

let tShirtMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#", selectedColor.value),
  side: THREE.DoubleSide,
});

dracoLoader.setDecoderPath(serverurl + "draco/");
loader.setDRACOLoader(dracoLoader);

/**
 * Loads a GLB model from the given URL and performs various operations on the loaded model.
 * @param {string} url - The URL of the GLB model to load.
 */
function loadGlbModelUrl(url) {
  loader.load(
    // resource URL
    url,
    // called when the resource is loaded
    function (gltf) {
      mesh = gltf.scene;
      let boxs = box3.setFromObject(mesh);
      let sizeV = new THREE.Vector3();
      boxs.getSize(sizeV);

      let sizeX = selectedModel.scale / sizeV.x;

      mesh.traverse((object) => {
        if (object.isMesh) {
          if (object.name.includes("pZone")) {
            decalMesh.push(object);
          }

          if (selectedModel.type) {
            if (selectedModel.material.includes(object.name)) {
              object.material.color = new THREE.Color(
                "#" + selectedColor.value
              );
              object.material.side = 2;
              object.material.needsUpdate = true;
              object.castShadow = true;
            }
          } else {
            object.material.color = new THREE.Color("#" + selectedColor.value);
            object.material.side = 2;
            object.material.needsUpdate = true;
            object.castShadow = true;
          }
        }
      });

      mesh.scale.set(sizeX, sizeX, sizeX);
      mesh.position.set(0, 0, 0);

      scene.add(mesh);

      sizeV = new THREE.Vector3();
      boxs = box3.setFromObject(mesh);
      boxs.getSize(sizeV);
      mesh.boundingSize = sizeV;

      updateBoundingBox();

      objectControls.setObjectToMove(mesh);
    },
    // called while loading is progressing
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // called when loading has errors
    function (error) {}
  );
}

/**
 * Updates the bounding box of the decal mesh objects.
 * If the decalMesh array has elements, it iterates through each element
 * and updates the bounding box properties.
 */
function updateBoundingBox() {
  if (decalMesh.length > 0) {
    decalMesh.forEach((value) => {
      let boxChild = box3.setFromObject(value);

      let sizeV1 = new THREE.Vector3();
      let posV1 = new THREE.Vector3();
      boxChild.getSize(sizeV1);
      boxChild.getCenter(posV1);
      value.boundingSize = sizeV1;
    });
    // console.log(decalMesh);
  }
}

modelList = JSON.parse(modelList);
let modelsArray = modelList.models;
selectedModel = modelsArray[0];
loadGlbModelUrl(modelsArray[0].url);

fontLoaded();

/**
 * Loads specified fonts using the FontFace API and adds them to the document's fonts collection.
 */
function fontLoaded() {
  document.fonts
    .add(Montserratfont)
    .load("12px Montserrat-Regular", "text")
    .then((value) => {});

  document.fonts
    .add(SixCapsfont)
    .load("12px SixCaps-Regular", "text")
    .then((value) => {});

  document.fonts
    .add(Condimentfont)
    .load("12px Condiment-Regular", "text")
    .then((value) => {});
}

/**
 * Renderer
 */
renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});

renderer.shadowMap.enabled = true;
renderer.shadowMapAutoUpdate = true;
renderer.physicallycorrectlights = false;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// renderer.soft
renderer.setSize(sizes.width, sizes.height);

/**
 * Retrieves the bounding rectangle of the renderer's DOM element.
 * @returns A DOMRect object representing the size of the renderer's DOM element.
 */
let rect = renderer.domElement.getBoundingClientRect();

/**
 * Initializes and configures object controls for a 3D scene.
 * @param {Camera} camera - The camera object to control.
 * @param {HTMLElement} domElement - The DOM element to attach the controls to.
 */
objectControls = new ObjectControls(camera, renderer.domElement);
objectControls.setRotationSpeed(0.1);
objectControls.setRotationSpeedTouchDevices(0.1);
objectControls.setDistance(80, 160); // sets the min - max distance able to zoom
objectControls.setZoomSpeed(2);

moved = meshParam.rotationEnable;

renderer.domElement.addEventListener("pointerdown", onPointerDown, false);
renderer.domElement.addEventListener("pointerup", onPointerUp, false);
renderer.domElement.addEventListener("pointermove", onPointerMove, false);

/**
 * Updates the mouse position based on the provided event.
 * @param {Event} event - The event containing the mouse coordinates.
 */
function updateMousePosition(event) {
  mouse.x = ((event.clientX - rect.left) / sizes.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / sizes.height) * 2 + 1;
}

/**
 * Handles the pointer down event on the renderer element.
 * Updates the mouse position, captures the pointer, and performs various actions based on the event.
 * @param {Event} event - The event object containing information about the pointer down event.
 */
function onPointerDown(event) {
  updateMousePosition(event);

  renderer.domElement.setPointerCapture(event.pointerId);
  event = event.changedTouches !== undefined ? event.changedTouches[0] : event;

  drag = false;
  moved = meshParam.rotationEnable;

  if (decals.length > 0) {
    let intersects1 = [];
    mouse.x = ((event.clientX - rect.left) / sizes.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / sizes.height) * 2 + 1;
    let Removedecals = decals.filter(
      (value) => value.properties.lock === false
    );

    raycasterMesh.setFromCamera(mouse, camera);
    raycasterMesh.intersectObjects(Removedecals, false, intersects1);
    if (intersects1.length > 0) {
      selectedDecal = intersects1[0].object;
      let sScale = selectedDecal.properties.scale.clone();
      mouseHelper.pid = selectedDecal.uuid;
      mouseHelper.position.copy(selectedDecal.properties.position);
      mouseHelper.rotation.set(
        selectedDecal.properties.orientation.x,
        selectedDecal.properties.orientation.y,
        selectedDecal.properties.rotation
      );
      mouseHelper.properties = selectedDecal.properties;
      mouseHelper.texture = selectedDecal.texture;
      mouseHelper.properties.scale = selectedDecal.properties.scale.clone();
      mouseHelper.properties.rotation = selectedDecal.properties.rotation
        ? selectedDecal.properties.rotation
        : null;
      mouseHelper.material.map = selectedDecal.texture;
      mouseHelper.material.needsUpdate = true;
      mouseHelper.name = selectedDecal.name;

      if (selectedDecal.name == "Text") {
        selectedDecal.texture.redraw();
      }
      mouseHelper.scale.set(sScale.x, sScale.y, 0.1);
      mouseHelper.visible = true;
      meshParam.rotationEnable = false;
      meshParam.uploadImage = true;
      meshParam.slide = "mouse";
      selectedDecal.visible = false;

      /**
       * Disables horizontal rotation for the object controls.
       * This function is used to prevent horizontal rotation of an object in a 3D space.
       */
      objectControls.disableHorizontalRotation();

      meshParam.rotationEnable = false;
      intersects1.length = 0;
    } else {
      if (intersection.intersects) {
        if (decals.length > 1) {
          meshParam.rotationEnable = false;
          meshParam.isNew = false;
          selectedDecal = null;
        } else {
          meshParam.rotationEnable = false;
          selectedDecal = null;
        }
      } else {
        selectedDecal = null;
        meshParam.rotationEnable = true;
        intersection.intersects = false;

        /**
         * Enable horizontal rotation for the object controls.
         * This function allows the object controls to rotate horizontally.
         */
        objectControls.enableHorizontalRotation();
      }
    }
  }
}

/**
 * Handles the pointer up event by updating the mouse position, releasing pointer capture,
 * and performing specific actions based on the event.
 * @param {Event} event - The pointer up event object.
 */
function onPointerUp(event) {
  updateMousePosition(event);
  /**
   * Releases the pointer capture for the specified pointer ID on the DOM element.
   * @param {number} pointerId - The ID of the pointer to release capture for.
   */
  renderer.domElement.releasePointerCapture(event.pointerId);
  drag = false;
  if (moved === false) {
    if (meshParam.uploadImage) {
      shoot();
      objectControls.enableHorizontalRotation();
    }
  }
}

/**
 * Handles the pointer move event by updating the mouse position, setting drag to true,
 * and checking for specific conditions related to the event.
 * @param {Event} event - The pointer move event object.
 */
function onPointerMove(event) {
  updateMousePosition(event);
  drag = true;
  if (event.isPrimary) {
    if (meshParam.uploadImage) {
      if (meshParam.slide == "mouse") {
        checkIntersection(event.clientX, event.clientY);
      }
    }
  }
}

/**
 * Listens for keydown events and performs actions based on the key pressed.
 * @param {Event} e - The keydown event object.
 */
document.addEventListener("keydown", async (e) => {
  e = e || window.event;

  if (e.keyCode === 38) {
    /**
     * Adjusts the scale of the decal when the up arrow key is pressed.
     * @param {number} scale - The amount by which to increase the scale.
     */
    decalScale(scale);
  } else if (e.keyCode === 40) {
    /**
     * Adjusts the scale of the decal when the down arrow key is pressed.
     * @param {number} scale - The amount by which to decrease the scale.
     */
    decalScale(-scale);
  } else if (e.keyCode === 37) {
    /**
     * If the left arrow key is pressed, rotate the decal to the left by the rotation step amount.
     * @param {number} rotationStep - The amount by which to rotate the decal.
     */
    decalRotation(-rotationStep);
  } else if (e.keyCode === 39) {
    /**
     * If the right arrow key is pressed, rotate the decal by the specified rotation step.
     * @param {number} rotationStep - The amount by which to rotate the decal.
     */
    decalRotation(rotationStep);
  }
});

function decalRotation(rotationStep) {
  /**
   * Rotates the mouse helper object on the Z-axis by the specified rotation step.
   * Updates the orientation and rotation properties of the mouse helper object accordingly.
   * If a decal is selected, the rotation is applied to the decal.
   * @param {boolean} selectedDecal - Indicates whether a decal is selected.
   * @param {number} rotationStep - The amount by which to rotate the mouse helper object.
   * @returns None
   */
  if (selectedDecal) {
    mouseHelper.rotateZ(+rotationStep);
    mouseHelper.properties.orientation = mouseHelper.rotation;
    mouseHelper.properties.rotation = mouseHelper.rotation.z;
  } else {
    mouseHelper.rotateZ(+rotationStep);
    mouseHelper.properties.orientation = mouseHelper.rotation;
    mouseHelper.properties.rotation = mouseHelper.rotation.z;
  }
}

function decalScale(scale) {
  /**
   * Adjusts the scale of a selected decal or mouse helper based on the provided scale value.
   * If a selected decal is present and its name is "image", it updates the scale values accordingly.
   * If no selected decal is present, it checks if the mouse helper's name is "image" and updates its scale.
   * @param {object} selectedDecal - The selected decal object.
   * @param {object} mouseHelper - The mouse helper object.
   * @param {number} scale - The scale value to be added to the current scale.
   * @param {number} imageScale - The scale value for the image.
   */
  if (selectedDecal) {
    if (selectedDecal.name == "image") {
      let scaleV = selectedDecal.properties.scale.x;
      let imageS = selectedDecal.properties.imageScale;
      scaleV = scaleV + scale;
      mouseHelper.scale.set(scaleV, scaleV * imageS, 0.1);
      mouseHelper.properties.scale = mouseHelper.scale;
      meshParam.scale = scaleV;
    }
  } else {
    if (mouseHelper.name == "image") {
      let scaleV = mouseHelper.scale.x;
      scaleV = scaleV + scale;
      mouseHelper.scale.set(scaleV, scaleV * imageScale, 0.1);
      mouseHelper.properties.scale = mouseHelper.scale;
      meshParam.scale = scaleV;
    }
  }
}

/**
 * Checks for intersection between the mouse position and a 3D object in the scene.
 * Updates the intersection point and normal if an intersection is found.
 * @param {number} x - The x-coordinate of the mouse position.
 * @param {number} y - The y-coordinate of the mouse position.
 * @returns None
 */
function checkIntersection(x, y) {
  if (mesh === undefined) return;
  mouse.x = ((x - rect.left) / sizes.width) * 2 - 1;
  mouse.y = -((y - rect.top) / sizes.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  raycaster.intersectObject(decalMesh[0], false, intersects);

  if (intersects.length > 0) {
    const p = intersects[0].point;
    mouseHelper.position.copy(p);
    intersection.point.copy(p);
    const n = intersects[0].face.normal.clone();
    n.transformDirection(mesh.matrixWorld);
    n.multiplyScalar(10);
    n.add(intersects[0].point);

    intersection.normal.copy(intersects[0].face.normal);
    intersection.rotation = n;
    mouseHelper.lookAt(n);

    if (mouseHelper.properties.rotation) {
      mouseHelper.rotation.set(
        mouseHelper.rotation.x,
        mouseHelper.rotation.y,
        mouseHelper.properties.rotation
      );
    }
    if (drag) {
      intersection.intersects = true;
    } else {
      intersection.intersects = false;
    }

    intersects.length = 0;
  } else {
    intersection.intersects = false;
  }
}

/**
 * Function to place a decal on a given mesh with specified position, rotation, size, and options.
 * @param {THREE.Mesh} Mainmesh - The main mesh on which the decal will be placed.
 * @param {THREE.Vector3} pos - The position of the decal.
 * @param {THREE.Euler} rot - The rotation of the decal.
 * @param {number} size - The size of the decal.
 * @param {object} options - Additional options for the decal placement.
 * @returns None
 */
function decalPlace(Mainmesh, pos, rot, size, options) {
  let decalDummyMaterial = new THREE.MeshPhongMaterial({
    specular: 0x444444,
    shininess: 30,
    map: options.texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    wireframe: false,
    side: THREE.DoubleSide,
  });

  let decalMeshDummy = new THREE.Mesh(
    new DecalGeometry(Mainmesh, pos, rot, size),
    decalDummyMaterial
  );
  decalMeshDummy.name = options.name;
  decalMeshDummy.texture = options.texture;
  let properties = {
    scale: size,
    position: pos,
    orientation: rot,
  };
  if (options.name == "Text") {
    properties.fontSize = options.properties.fontSize;
    properties.text = options.properties.text;
    properties.color = options.properties.color;
    properties.fontFamily = options.properties.fontFamily;
    properties.uuid = options.properties.uuid;
    properties.lock = options.properties.lock;
  } else {
    properties.imageScale = options.properties.imageScale;
    properties.imagesrc = options.properties.imagesrc;
    properties.uuid = options.properties.uuid;
    properties.lock = options.properties.lock;
  }

  if (options.properties.rotation) {
    properties.rotation = options.properties.rotation;
  }

  decalMeshDummy.properties = properties;
  decalMeshDummy.mainMesh = Mainmesh;
  decalMeshDummy.renderOrder = decals.length;

  scene.add(decalMeshDummy);
  decals.push(decalMeshDummy);
  let imageMap = {};
  if (options.name == "image") {
    if (decalImageMap.has(properties.uuid)) {
      imageMap = decalImageMap.get(properties.uuid);
      imageMap.decalid = decalMeshDummy.uuid;
    }
  } else {
    if (decalTextMap.has(properties.uuid)) {
      imageMap = decalTextMap.get(properties.uuid);
      imageMap.decalid = decalMeshDummy.uuid;
    }
  }

  DecalMapDuplicate();

  decalMeshDummy = null;
  /**
   * Sets the object to move to the specified objects, including a mesh and an array of decals.
   * @param {Array} objects - An array of objects to be moved.
   */
  objectControls.setObjectToMove([mesh, ...decals]);
  loadLayersUI();
}

/**
 * Removes entries from decalImageMap and decalTextMap that do not have a decalid property.
 */
function DecalMapDuplicate() {
  decalImageMap.forEach(function (item, key, mapObj) {
    if (!item.decalid) {
      decalImageMap.delete(key);
    }
  });

  decalTextMap.forEach(function (item, key, mapObj) {
    if (!item.decalid) {
      decalTextMap.delete(key);
    }
  });
}

/**
 * Updates the position, orientation, and size of a mesh based on the mouse interaction.
 * Also handles decal placement, size calculations, and visibility toggles.
 * @returns None
 */
function shoot() {
  meshParam.slide = "slide";
  position.copy(intersection.point);
  orientation.copy(mouseHelper.rotation);
  removeDecals(mouseHelper.pid);
  if (mouseHelper.properties) {
    size.set(
      mouseHelper.properties.scale.x,
      mouseHelper.properties.scale.y,
      mouseHelper.properties.scale.x
    );
    if (mouseHelper.properties.rotation) {
      orientation.set(
        orientation.x,
        orientation.y,
        mouseHelper.properties.rotation
      );
    }
  } else {
    size.set(meshParam.scale, meshParam.scale * imageScale, meshParam.scale);
  }

  decalPlace(
    decalMesh[0],
    position.clone(),
    orientation,
    size.clone(),
    mouseHelper
  );

  if (mouseHelper.name == "image") {
    let widthP = Math.round(size.x);
    let heightP = Math.round(size.y);
    printSizeTxt =
      "Print size : " + widthP + " cm (L) x " + heightP + " cm (H)";
    // console.log(printSizeTxt);
  }

  meshParam.uploadImage = false;
  mouseHelper.visible = false;
  selectedDecal = null;
  meshParam.isNew = false;

  selectDecalThumbActive();
  addPrintSizeText();
}

/**
 * Removes a decal from the scene based on the decal ID.
 * @param {string} id - The ID of the decal to be removed.
 */

function removeDecals(id) {
  decals.forEach(function (d) {
    if (d.uuid == id) {
      scene.remove(d);
    }
  });
  const filteredPeople = decals.filter((item) => item.uuid !== id);
  decals = filteredPeople;
}

/**
 * Removes all decals from the scene by iterating through the 'decals' array,
 * removing each decal from the scene, and then clearing the 'decalImageMap' and 'decalTextMap'.
 */
function removeAllDecals() {
  decals.forEach(function (d) {
    scene.remove(d);
  });
  decalImageMap.clear();
  decalTextMap.clear();
  decals.length = 0;
  selectedDecal = null;
}

/**
 * Generates a texture for the given text with specified size, color, and font family.
 * @param {string} text - The text to be displayed on the texture.
 * @param {number} size - The font size of the text.
 * @param {string} color - The color of the text.
 * @param {string} fontFamily - The font family for the text.
 * @returns {TextTexture} A texture object representing the text.
 */
function gettextTexture(text, size, color, fontFamily) {
  let textLine = text.split("\\n");
  return new TextTexture({
    alignment: "center",
    color: color,
    fontFamily: fontFamily,
    fontSize: size,
    text: textLine.join("\n"),
    padding: 0,
  });
}

/**
 * Uploads text to a 3D scene with specified properties.
 * @param {string} text - The text to be displayed.
 * @param {number} size - The font size of the text.
 * @param {string} color - The color of the text.
 * @param {string} fontFamily - The font family of the text.
 * @param {string} parentId - The ID of the parent element to which the text is attached.
 * @returns None
 */
function uploadText(text, size, color, fontFamily, parentId) {
  document.fonts.load("12px " + fontFamily).then((value) => {
    let texture = gettextTexture(text, size, color, fontFamily);
    meshParam.scale = 10;
    imageScale = texture.height / texture.width;
    let scaleI = new THREE.Vector3(texture.width, texture.height, 0.1);
    scaleI.multiplyScalar(fontScaleGlobal);

    let decalDummyMaterial = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      wireframe: false,
    });
    mouseHelper.material = decalDummyMaterial;
    mouseHelper.name = "Text";
    mouseHelper.texture = texture;
    mouseHelper.properties = {
      text,
      fontSize: size,
      color,
      fontFamily: texture.fontFamily,
    };
    let imageUUID = uuidv4();
    decalTextMap.set(imageUUID, {
      texture,
      properties: mouseHelper.properties,
      type: "text",
      uId: parentId,
    });
    mouseHelper.material.needsUpdate = true;
    mouseHelper.texture = texture;
    texture.redraw();
    meshParam.uploadImage = false;
    meshParam.slide = "mouse";
    meshParam.rotationEnable = false;
    mouseHelper.visible = true;
    mouseHelper.position.set(mouse.x, mouse.y, mouse.z);
    mouseHelper.scale.copy(scaleI);
    mouseHelper.rotation.set(0, 0, 0);
    mouseHelper.properties.scale = mouseHelper.scale;
    mouseHelper.properties.rotation = null;
    mouseHelper.properties.uuid = imageUUID;
    mouseHelper.properties.lock = false;
    meshParam.isNew = true;
    let scaleN = new THREE.Vector3(scaleI.x, scaleI.y, scaleI.x);
    let boundingSize = decalMesh[0].boundingSize;
    mouseHelper.position.set(mouse.x, mouse.y, boundingSize.z / 2);

    /**
     * Append hidden fields to a parent element with the given ID, containing the image UUID.
     */
    appendHiddenFields(parentId, imageUUID);

    /**
     * Place a decal on a mesh at the specified position, rotation, and scale.
     */
    decalPlace(
      decalMesh[0],
      mouseHelper.position.clone(),
      mouseHelper.rotation.clone(),
      scaleN.clone(),
      mouseHelper
    );
    mouseHelper.visible = false;
  });
}

/**
 * Appends a hidden input field to a specified parent element with the given UUID value.
 * If an input field with the same ID already exists, it is removed before appending the new one.
 * @param {string} parentId - The ID of the parent element to which the hidden input field will be appended.
 * @param {string} uuid - The UUID value to be set as the value of the hidden input field.
 */
function appendHiddenFields(parentId, uuid) {
  let Uid = "TextB" + parentId;
  if (document.getElementById(Uid)) {
    document.getElementById(Uid).remove();
  }

  const nodeUl = document.createElement("input");
  nodeUl.type = "hidden";
  nodeUl.classList.add("textDecalMap");
  nodeUl.id = Uid;
  nodeUl.value = uuid;
  document.getElementById(parentId).appendChild(nodeUl);
}

/**
 * Uploads a design file and processes it to be displayed on a mesh.
 * @param {string} file - The file to be uploaded.
 * @returns None
 */
function uploadDesign(file) {
  var image = new Image();

  image.onload = function () {
    imageScale = this.height / this.width;
    meshParam.scale = 10;
    selectedDecalImg = image.src;
    var texture = new THREE.TextureLoader().load(image.src);
    let decalDummyMaterial = new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      wireframe: false,
    });
    let imageUUID = uuidv4();
    decalImageMap.set(imageUUID, { image, src: image.src, type: "image" });
    mouseHelper.name = "image";
    mouseHelper.texture = texture;
    mouseHelper.properties = {};
    mouseHelper.material = decalDummyMaterial;
    mouseHelper.material.needsUpdate = true;

    meshParam.uploadImage = false;
    meshParam.slide = "mouse";
    meshParam.rotationEnable = false;
    mouseHelper.visible = true;
    mouseHelper.position.set(mouse.x, mouse.y, mouse.z);
    mouseHelper.scale.set(meshParam.scale, meshParam.scale * imageScale, 0.01);
    mouseHelper.rotation.set(0, 0, 0);
    mouseHelper.properties.scale = mouseHelper.scale;
    mouseHelper.properties.imageScale = imageScale;
    mouseHelper.properties.imagesrc = image.src;
    mouseHelper.properties.uuid = imageUUID;
    mouseHelper.properties.lock = false;
    mouseHelper.properties.rotation = null;
    meshParam.isNew = true;
    let scaleN = new THREE.Vector3(
      meshParam.scale,
      meshParam.scale * imageScale,
      meshParam.scale
    );
    let boundingSize = decalMesh[0].boundingSize;
    mouseHelper.position.set(mouse.x, mouse.y, boundingSize.z / 2);
    decalPlace(
      decalMesh[0],
      mouseHelper.position.clone(),
      mouseHelper.rotation.clone(),
      scaleN.clone(),
      mouseHelper
    );
    mouseHelper.visible = false;
    meshParam.uploadImage = false;
    selectDecalThumbActive();
    addPrintSizeText();
  };

  // I believe .src needs to be assigned after .onload has been declared
  image.src = file;
}

/**
 * Updates the text decals on the map with the provided details.
 * @param {string} Mapid - The ID of the map where the text decals are located.
 * @param {string} parentId - The ID of the parent element containing the text input.
 * @returns None
 */
function updateTextDecals(Mapid, parentId) {
  let decalMapDetails = decalTextMap.get(Mapid);
  let text = document.getElementById("TextInput_" + parentId).value;
  let fontFamily = document.getElementById(
    "ChooseFontFamily_" + parentId
  ).value;
  let color = "#000000";
  let size = parseFloat(
    document.getElementById("ChooseFontSize_" + parentId).value
  );

  let selectedTextDecals = decals.filter(
    (value) => value.uuid === decalMapDetails.decalid
  );

  let texture = gettextTexture(text, size, color, fontFamily);
  let position = selectedTextDecals[0].properties.position.clone();
  let rot = selectedTextDecals[0].properties.orientation.clone();
  let imageUUID = selectedTextDecals[0].properties.uuid;

  if (selectedTextDecals[0].properties.rotation) {
    rot.set(rot.x, rot.y, selectedTextDecals[0].properties.rotation);
  }
  meshParam.isNew = false;

  removeDecals(selectedTextDecals[0].uuid);
  let sizeP = new THREE.Vector3(texture.width, texture.height, texture.width);
  sizeP.multiplyScalar(fontScaleGlobal);

  let properties = {
    name: "Text",
    text,
    fontSize: size,
    color,
    fontFamily: texture.fontFamily,
    scale: sizeP,
    position: position,
    orientation: rot,
    texture: texture,
    rotation: selectedTextDecals[0].properties.rotation,
    uuid: imageUUID,
    lock: selectedTextDecals[0].properties.lock,
  };

  let options = {
    name: "Text",
    properties: properties,
    texture: texture,
  };

  texture.redraw();
  decalPlace(decalMesh[0], position.clone(), rot, sizeP.clone(), options);
  texture.redraw();
}

loadSettingsUI();

function loadLayersUI() {
  removeControlsDecals();
}

/**
 * Function to load the settings user interface.
 */
function loadSettingsUI() {
  let decalImage = decals.filter((value) => value.type === "image");
  /**
   * Generates an HTML content using the provided settings to populate a template.
   * @param {Object} settings - An object containing various settings for the template.
   * @param {string} settings.background - The background color or image for the template.
   * @param {string[]} settings.colors - An array of colors for t-shirts.
   * @param {boolean} settings.rotation - A boolean indicating if rotation is enabled.
   * @param {number} settings.scale - The scale of the mesh divided by 10.
   * @param {string} settings.serverurl - The URL of the server.
   * @param {number} settings.rot - The rotation value.
   * @param {Object[]} settings.models - An array of models.
   */
  var html = settingsTemplate({
    background: bg,
    colors: tshirtsColors,
    rotation: meshParam.rotationEnable,
    scale: meshParam.scale / 10,
    serverurl: serverurl,
    rot: 0,
    models: modelsArray,
    selectmodel: selectedModel.id,
    images: decalImage,
  });
  settingLayoutUI.innerHTML = html;

  screenshotClick();
  uploadDesignBtnClick();
  colorPickerClick();
  backgroundClickFunction();
  activeBG();
  RotationCheckBoxChange();
  ScaleClickChangeEvent();
  selectDecalThumbActive();
  decalRemoveBtnclick();
  addPrintSizeText();
  modelSelectionEnable();
  modelSellectionActive();
  loadLayersUI();
  TextAddToSceneList();
  TextBoxEnterClick();
  TextRemoveButtonAction();
  selectTextDecals();
}

/**
 * Defines the actions for various buttons related to text manipulation.
 */
function TextRemoveButtonAction() {
  Array.from(document.querySelectorAll(".textrotatebtn")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("click", function () {});
    e.addEventListener("click", (e) => {
      let parentid = e.target.getAttribute("data-id");
      if (parentid) {
        let mapid = document.getElementById("TextB" + parentid).value;
        decalRotationFunction(mapid, "text");
      }
    });
  });
  Array.from(document.querySelectorAll(".removeTextDesignbtn")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("click", function () {});
    e.addEventListener("click", (e) => {
      let flags = e.target.getAttribute("data-flags");
      let parentid = e.target.getAttribute("data-id");
      let mapidele = document.getElementById("TextB" + parentid);
      if (mapidele) {
        let mapid = mapidele.value;
        Swal.fire({
          title: "Are you sure?",
          text: "You won't be able to revert this!",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Yes, delete it!",
        }).then((result) => {
          if (result.isConfirmed) {
            if (flags == "yes") {
              if (decalTextMap.get(mapid)) {
                decalRemoveFunction(mapid, "text");
              }

              document.getElementById(parentid).remove();
              selectTextDecals();
            } else {
              if (decalTextMap.get(mapid)) {
                decalRemoveFunction(mapid, "text");
              }

              document.getElementById("TextB" + parentid).value = "";
              document.getElementById("TextInput_" + parentid).value = "";
              selectTextDecals();
            }
          }
        });
      } else {
        document.getElementById(parentid).remove();
        selectTextDecals();
      }
    });
  });

  /**
   * - Handles change events for choosing font size.
   */
  Array.from(document.querySelectorAll(".ChooseFontSize")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("change", function () {});
    e.addEventListener("change", (e) => {
      let parentid = e.target.getAttribute("data-id");
      let mapid = document.getElementById("TextB" + parentid).value;
      updateTextDecals(mapid, parentid);
    });
  });

  /**
   * - Handles change events for choosing font family.
   */
  Array.from(document.querySelectorAll(".ChooseFontFamily")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("change", function () {});
    e.addEventListener("change", (e) => {
      let parentid = e.target.getAttribute("data-id");
      let mapid = document.getElementById("TextB" + parentid).value;
      updateTextDecals(mapid, parentid);
    });
  });
}

/**
 * Adds a text element to the scene list when the addTextBtn is clicked.
 * It generates a unique ID for the text element, creates the HTML template for the text element,
 * appends the text element to the TextListLayout, and adds event listeners for text removal and text box interaction.
 */
function TextAddToSceneList() {
  Array.from(document.querySelectorAll(".addTextBtn")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("click", function () {});
    e.addEventListener("click", (e) => {
      let Uid = Date.now();
      var html = TextListTemplate({
        id: Uid,
        text: "",
        add: false,
        flags: "yes",
      });
      const nodeUl = document.createElement("ul");
      nodeUl.classList.add("textlayoutul");
      nodeUl.id = Uid;
      nodeUl.innerHTML = html;
      let TextListLayout = document.getElementById("TextListLayout");
      TextListLayout.appendChild(nodeUl);
      TextRemoveButtonAction();
      TextBoxEnterClick();
    });
  });
}

/**
 * Adds an event listener to text input elements with the class "textInput" to trigger
 * an action when the Enter key is pressed.
 * The action includes extracting the text value, font family, font color, size, and parent ID
 * from the input elements and then either uploading the text or updating existing text decals
 * based on the presence of a corresponding element.
 * @returns None
 */
function TextBoxEnterClick() {
  Array.from(document.querySelectorAll(".textInput")).forEach((e) => {
    e.onclick = "";
    e.removeEventListener("keydown", function () {});
    e.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        let parentId = e.target.getAttribute("data-id");
        let text = e.target.value;
        let fontFamily = document.getElementById(
          "ChooseFontFamily_" + parentId
        ).value;
        let fontColor = "#000000";
        let size = parseFloat(
          document.getElementById("ChooseFontSize_" + parentId).value
        );
        let Uid = "TextB" + parentId;
        let decalMapEle = document.getElementById(Uid);
        if (!decalMapEle) {
          uploadText(text, size, fontColor, fontFamily, parentId);
        } else {
          let mapid = decalMapEle.value;
          updateTextDecals(mapid, parentId);
        }
      }
    });
  });
}

/**
 * Sets the value of the modelSelection element to the id of the selected model.
 */
function modelSellectionActive() {
  let modelSelection = document.getElementById("modelSelection");
  modelSelection.value = selectedModel.id;
}

/**
 * Enables model selection functionality by adding event listeners to the elements with the id "modelSelection".
 * When an element with id "modelSelection" is clicked, it triggers a change event that loads a GLB model based on the selected value.
 * @returns None
 */
function modelSelectionEnable() {
  Array.from(document.querySelectorAll("#modelSelection")).forEach((e) => {
    // Add a data-attribute to store the current onclickvalue.

    e.onclick = "";
    e.removeEventListener("change", function () {});
    e.addEventListener("change", (e) => {
      let Did = e.target.value;
      let modelselect = modelsArray.filter((x) => x.id === Did);
      selectedModel = modelselect[0];
      decalMesh.length = 0;
      if (mesh) {
        scene.remove(mesh);
      }
      mesh = null;
      selectedDecalImg = null;
      selectDecalThumbActive();
      addPrintSizeText();
      loadGlbModelUrl(selectedModel.url);
    });
  });
}

/**
 * Adds a click event listener to elements with the class "removeDesignbtn" to handle
 * the removal of decals. When clicked, it prompts the user to confirm the deletion
 * and then calls the decalRemoveFunction to remove the selected decal.
 * @returns None
 */
function decalRemoveBtnclick() {
  Array.from(document.querySelectorAll(".removeDesignbtn")).forEach((e) => {
    // Add a data-attribute to store the current onclickvalue.
    e.onclick = "";
    e.removeEventListener("click", function () {});
    e.addEventListener("click", (e) => {
      if (decals.length > 0) {
        let decalimageinput = document.querySelector(
          ".decalimageinput:checked"
        );
        if (decalimageinput) {
          Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!",
          }).then((result) => {
            if (result.isConfirmed) {
              decalRemoveFunction(decalimageinput.value, "image");
            }
          });
        } else {
          Swal.fire({
            title: "Please select image",
            text: "Please select image",
            icon: "warning",
          });
        }
      }
    });
  });
}

/**
 * Selects text decals based on the decalTextMap and updates the TextListLayout accordingly.
 * If decalTextMap is not empty, it iterates through the map, retrieves the properties of each decal,
 * creates HTML elements for each decal, and appends them to the TextListLayout.
 * If decalTextMap is empty, it creates an empty text decal and appends it to the TextListLayout.
 * Additionally, it sets up event listeners for removing text, handling text box enter key press, and adding text to the scene list.
 */
function selectTextDecals() {
  let TextListLayout = document.getElementById("TextListLayout");
  TextListLayout.innerHTML = "";
  if (decalTextMap.size > 0) {
    let i = 0;
    let add = false;
    let flags = "no";
    decalTextMap.forEach((value, key) => {
      if (i == 0) {
        add = true;
        flags = "yes";
      } else {
        add = false;
        flags = "no";
      }
      let decalProperties = decals.filter(
        (value1) => value1.uuid === value.decalid
      );

      let properties = decalProperties[0].properties;
      let Uid = Date.now();
      var html = TextListTemplate({
        id: key,
        text: properties.text,
        add: add,
        flags: flags,
      });
      const nodeUl = document.createElement("ul");
      nodeUl.classList.add("textlayoutul");
      nodeUl.id = key;
      nodeUl.innerHTML = html;

      TextListLayout.appendChild(nodeUl);
      // appendHiddenFields(key, key);
      Uid = "TextB" + key;

      const nodeUl1 = document.createElement("input");
      nodeUl1.type = "hidden";
      nodeUl1.classList.add("textDecalMap");
      nodeUl1.id = Uid;
      nodeUl1.value = key;
      document.getElementById(key).appendChild(nodeUl1);

      document.getElementById("ChooseFontSize_" + key).value =
        properties.fontSize;

      document.getElementById("ChooseFontFamily_" + key).value =
        properties.fontFamily;

      i++;
    });
  } else {
    let Uid = Date.now();
    var html = TextListTemplate({
      id: Uid,
      text: "",
      add: true,
      flags: "yes",
    });
    const nodeUl = document.createElement("ul");
    nodeUl.classList.add("textlayoutul");
    nodeUl.id = Uid;
    nodeUl.innerHTML = html;
    let TextListLayout = document.getElementById("TextListLayout");
    TextListLayout.appendChild(nodeUl);
  }
  TextRemoveButtonAction();
  TextBoxEnterClick();
  TextAddToSceneList();
}

/**
 * Selects the active decal thumbnail and updates the UI accordingly.
 * This function iterates over the decalImageMap, creates thumbnail elements for each decal,
 * and adds event listeners for locking and selecting decal images.
 */
function selectDecalThumbActive() {
  const decalThumbList = document.querySelector("#previewimagelist");
  if (decalImageMap.size > 0) {
    decalThumbList.innerHTML = "";
    let i = 0;
    let selected;
    decalImageMap.forEach((value, key) => {
      selected = false;
      if (i == 0) {
        selected = true;
      }
      let decalSp = decals.filter((value1) => value1.uuid === value.decalid);

      let properties = decalSp[0].properties;

      var li = document.createElement("li");

      var inputele = document.createElement("input");
      inputele.type = "radio";
      inputele.name = "decalimage";
      inputele.value = key;
      inputele.classList.add("decalimageinput");
      if (selected) {
        inputele.setAttribute("checked", "true");
      }

      li.appendChild(inputele);
      var imageEle = document.createElement("img");
      imageEle.src = value.src;

      li.appendChild(imageEle);
      let lockSpanEle = document.createElement("span");
      lockSpanEle.classList.add("locksettingLayout");
      let lockEle = document.createElement("img");
      lockEle.src = properties.lock ? lockImg : unlockImg;
      lockEle.classList.add("locksettings");
      lockSpanEle.appendChild(lockEle);
      lockSpanEle.setAttribute("data-uuid", value.decalid);
      lockSpanEle.setAttribute("data-id", key);
      li.appendChild(lockSpanEle);

      li.setAttribute("data-uuid", value.decalid);
      li.setAttribute("data-id", key);
      li.setAttribute("style", "display: block;"); // remove the bullets.

      lockSpanEle.addEventListener("click", function (e) {
        const parentElement = e.target.parentElement;
        let decalid = parentElement.getAttribute("data-uuid");
        let imageid = parentElement.getAttribute("data-id");
        let decalMapDetails = decalImageMap.get(imageid);
        let decalM = decals.filter(
          (value) => value.uuid === decalMapDetails.decalid
        );

        if (decalM.length > 0) {
          decalM[0].properties.lock = decalM[0].properties.lock ? false : true;
          selectDecalThumbActive();
        }
      });

      inputele.addEventListener("click", function (e) {
        const parentElement = e.target.parentElement;

        let decalid = parentElement.getAttribute("data-uuid");
        let imageid = parentElement.getAttribute("data-id");
        let decalMapDetails = decalImageMap.get(imageid);
        let decalM = decals.filter(
          (value) => value.uuid === decalMapDetails.decalid
        );
        if (decalM.length > 0) {
          decalM[0].renderOrder = 10;
        } else {
          let decalSR = decals.filter(
            (value) => value.uuid !== decalMapDetails.decalid
          );
          decalSR.forEach((value) => {
            value.renderOrder = 1;
          });
        }
        addPrintSizeText();
        document.querySelectorAll("#previewimagelist");
        removeControlsDecals();
      });

      decalThumbList.appendChild(li); // append li to ul.
      i++;
    });
    removeControlsDecals();
  } else {
    decalThumbList.innerHTML = "";
    removeControlsDecals();
  }
}

/**
 * Removes controls decals based on the presence of a checked decal image input.
 * If the decal image input is checked and has a value, adds the "visible" class to elements with the "decalshow" class.
 * If the decal image input is checked but has no value, removes the "visible" class from elements with the "decalshow" class.
 * If no decal image input is checked, removes the "visible" class from elements with the "decalshow" class.
 */
function removeControlsDecals() {
  let decalimageinput = document.querySelector(".decalimageinput:checked");

  if (decalimageinput) {
    if (decalimageinput.value) {
      Array.from(document.querySelectorAll(".decalshow")).forEach((e) => {
        e.classList.add("visible");
      });
    } else {
      Array.from(document.querySelectorAll(".decalshow")).forEach((e) => {
        e.classList.remove("visible");
      });
    }
  } else {
    Array.from(document.querySelectorAll(".decalshow")).forEach((e) => {
      e.classList.remove("visible");
    });
  }
}

/**
 * Updates the print size text element based on the selected decal image.
 * If a decal image is selected, it calculates the width and height of the decal
 * and displays the print size in centimeters.
 * If no decal image is selected or decals array is empty, it clears the print size text element.
 */
function addPrintSizeText() {
  let printSizeTxtEle = document.querySelector("#printSizeTxt");
  if (decals.length > 0) {
    let decalimageinput = document.querySelector(".decalimageinput:checked");
    if (decalimageinput) {
      decalimageinput = decalimageinput.value;
      let decalMapDetails = decalImageMap.get(decalimageinput);
      let decalM = decals.filter(
        (value) => value.uuid === decalMapDetails.decalid
      );
      let selectedD = decalM[0];

      if (selectedD) {
        let widthP = Math.round(selectedD.properties.scale.x);
        let heightP = Math.round(selectedD.properties.scale.y);
        printSizeTxt =
          "Print size : " + widthP + " cm (L) x " + heightP + " cm (H)";
        // console.log(printSizeTxt);
        printSizeTxtEle.innerHTML = printSizeTxt;
      } else {
        printSizeTxtEle.innerHTML = "";
        removeControlsDecals();
      }
    }
  } else {
    printSizeTxtEle.innerHTML = "";
    removeControlsDecals();
  }
}

/**
 * Removes a decal function based on the decal image input and map type.
 * @param {string} decalimageinput - The input for the decal image.
 * @param {string} maptype - The type of map (e.g., "text").
 * @returns None
 */
function decalRemoveFunction(decalimageinput, maptype) {
  let decalMapDetails = decalImageMap.get(decalimageinput);
  if (maptype == "text") {
    decalMapDetails = decalTextMap.get(decalimageinput);
  }
  let decalM = decals.filter((value) => value.uuid === decalMapDetails.decalid);
  let selectedDecalMesh = decalM[0];
  if (selectedDecalMesh) {
    removeDecals(selectedDecalMesh.uuid);
    mouseHelper.visible = false;

    meshParam.rotationEnable = true;
    selectedDecalImg = null;
    decalImageMap.delete(decalimageinput);
    decalTextMap.delete(decalimageinput);
    selectDecalThumbActive();
    printSizeTxt = "";
    addPrintSizeText();
    Swal.fire({
      title: "Removed!",
      text: "Your design has been removed.",
      icon: "success",
    });
  }
}

/**
 * Function to handle scaling of a decal based on the provided parameters.
 * @param {string} decalimageinput - The input image for the decal.
 * @param {string} scaletype - The type of scaling operation to perform (up or down).
 * @param {string} maptype - The type of map for the decal (text or image).
 */
function decalScaleFunction(decalimageinput, scaletype, maptype) {
  let decalMapDetails = decalImageMap.get(decalimageinput);
  if (maptype == "text") {
    decalMapDetails = decalTextMap.get(decalimageinput);
  }
  let decalM = decals.filter((value) => value.uuid === decalMapDetails.decalid);
  let selectedDecalMesh = decalM[0];
  if (selectedDecalMesh) {
    selectedDecalMesh.visible = true;
    let sScale = selectedDecalMesh.properties.scale.clone();
    /**
     * Updates the properties of the mouse helper object based on the selected decal mesh.
     * @param {Object} selectedDecalMesh - The selected decal mesh object.
     */
    mouseHelper.pid = selectedDecalMesh.uuid;
    mouseHelper.position.copy(selectedDecalMesh.properties.position);
    mouseHelper.rotation.set(
      selectedDecalMesh.properties.orientation.x,
      selectedDecalMesh.properties.orientation.y,
      selectedDecalMesh.properties.rotation
        ? selectedDecalMesh.properties.rotation
        : 0
    );
    mouseHelper.properties = selectedDecalMesh.properties;
    mouseHelper.texture = selectedDecalMesh.texture;
    mouseHelper.properties.scale = selectedDecalMesh.properties.scale.clone();
    mouseHelper.properties.rotation = selectedDecalMesh.properties.rotation
      ? selectedDecalMesh.properties.rotation
      : null;
    mouseHelper.material.map = selectedDecalMesh.texture;
    mouseHelper.material.needsUpdate = true;
    mouseHelper.name = selectedDecalMesh.name;

    if (selectedDecalMesh.name == "Text") {
      selectedDecalMesh.texture.redraw();
    }
    mouseHelper.scale.set(sScale.x, sScale.y, 0.1);

    meshParam.uploadImage = false;
    meshParam.slide = "mouse";
    mouseHelper.visible = true;
    meshParam.rotationEnable = false;

    let scaleV = selectedDecalMesh.properties.scale.x;
    let imageS = selectedDecalMesh.properties.imageScale;
    let scale = 1;
    if (scaletype == "up") {
      scaleV = scaleV + scale;
    } else {
      scaleV = scaleV - scale;
    }

    mouseHelper.scale.set(scaleV, scaleV * imageS, 0.1);
    mouseHelper.properties.scale = mouseHelper.scale.clone();
    let lScaleV = new THREE.Vector3(scaleV, scaleV * imageS, scaleV);
    meshParam.scale = scaleV;
    removeDecals(selectedDecalMesh.uuid);
    decalPlace(
      decalMesh[0],
      selectedDecalMesh.properties.position.clone(),
      selectedDecalMesh.properties.orientation.clone(),
      lScaleV.clone(),
      mouseHelper
    );
    mouseHelper.visible = false;
    addPrintSizeText();
  }
}

/**
 * Function to handle rotation of a decal image based on the map type.
 * @param {string} decalimageinput - The input decal image.
 * @param {string} maptype - The type of map (e.g., "text").
 * @returns None
 */
function decalRotationFunction(decalimageinput, maptype) {
  let decalMapDetails = decalImageMap.get(decalimageinput);
  if (maptype == "text") {
    decalMapDetails = decalTextMap.get(decalimageinput);
  }
  let decalM = decals.filter((value) => value.uuid === decalMapDetails.decalid);
  let selectedDecalMesh = decalM[0];
  /**
   * If a selected decal mesh exists, perform various operations on the mouse helper object
   * and the selected decal mesh.
   * @param {Object} selectedDecalMesh - The selected decal mesh object.
   */
  if (selectedDecalMesh) {
    selectedDecalMesh.visible = false;
    let sScale = selectedDecalMesh.properties.scale.clone();
    /**
     * Updates the properties of the mouse helper object based on the selected decal mesh.
     * @param {Object} selectedDecalMesh - The selected decal mesh object.
     */
    mouseHelper.pid = selectedDecalMesh.uuid;
    mouseHelper.position.copy(selectedDecalMesh.properties.position);
    mouseHelper.properties = selectedDecalMesh.properties;
    mouseHelper.texture = selectedDecalMesh.texture;
    mouseHelper.properties.scale = selectedDecalMesh.properties.scale.clone();
    mouseHelper.properties.rotation = selectedDecalMesh.properties.rotation
      ? selectedDecalMesh.properties.rotation
      : null;
    mouseHelper.material.map = selectedDecalMesh.texture;
    mouseHelper.material.needsUpdate = true;
    mouseHelper.name = selectedDecalMesh.name;

    if (selectedDecalMesh.name == "Text") {
      selectedDecalMesh.texture.redraw();
    }
    mouseHelper.scale.set(sScale.x, sScale.y, 0.1);

    // meshParam.rotationEnable = false;
    meshParam.uploadImage = false;
    meshParam.slide = "mouse";
    mouseHelper.visible = true;
    meshParam.rotationEnable = false;

    mouseHelper.rotateZ(-rotationStep);
    mouseHelper.properties.orientation = mouseHelper.rotation;
    mouseHelper.properties.rotation = mouseHelper.rotation.z;
    removeDecals(selectedDecalMesh.uuid);
    decalPlace(
      decalMesh[0],
      mouseHelper.properties.position.clone(),
      mouseHelper.properties.orientation.clone(),
      sScale.clone(),
      mouseHelper
    );
    mouseHelper.visible = false;
  }
}

/**
 * Function to handle the change event of rotation checkboxes.
 * It adds a click event listener to each element with the class "rotatebtn".
 * When clicked, it checks if there are any decals selected,
 * then retrieves the value of the selected decal image input and calls the decalRotationFunction.
 */
function RotationCheckBoxChange() {
  Array.from(document.querySelectorAll(".rotatebtn")).forEach((e) => {
    e.onclick = "";
    e.addEventListener("click", (e) => {
      if (decals.length > 0) {
        let decalimageinput = document.querySelector(
          ".decalimageinput:checked"
        ).value;
        decalRotationFunction(decalimageinput, "image");
      }
    });
  });
}

/**
 * Attaches a click event listener to elements with the class "scalebtn".
 * When clicked, it retrieves the data-type attribute of the clicked element
 * and calls the decalScaleFunction with the appropriate parameters.
 * If there are decals present, it retrieves the value of the checked decal image input
 * and passes it along with the scaletype and "image" to the decalScaleFunction.
 */
function ScaleClickChangeEvent() {
  Array.from(document.querySelectorAll(".scalebtn")).forEach((e) => {
    e.onclick = "";
    e.addEventListener("click", (e) => {
      let scaletype = e.target.getAttribute("data-type");
      if (decals.length > 0) {
        let decalimageinput = document.querySelector(
          ".decalimageinput:checked"
        ).value;
        decalScaleFunction(decalimageinput, scaletype, "image");
      }
    });
  });
}

/**
 * Handles the click event for color picker elements on the page.
 * Updates the color of the selected object based on the color chosen.
 * @returns None
 */
function colorPickerClick() {
  Array.from(document.querySelectorAll(".colorclick")).forEach((e) => {
    // Add a data-attribute to store the current onclickvalue.
    e.dataset.Did = e.getAttribute("data-id"); // gets the attribute value.

    e.dataset.Dcolor = e.getAttribute("data-color");
    e.onclick = "";
    e.addEventListener("click", function () {
      document.querySelector(".colorclick.active")
        ? document
            .querySelector(".colorclick.active")
            .classList.remove("active")
        : "";
      this.classList.add("active");
      let Did = this.dataset.Did;
      let bgselect = tshirtsColors.filter((x) => x.value === Did);
      selectedColor = bgselect[0];

      /**
       * Traverses through each object in the mesh and applies color and shadow settings based on conditions.
       * @param {Object3D} mesh - The mesh object to traverse.
       * @returns None
       */
      mesh.traverse((object) => {
        if (object.isMesh) {
          if (selectedModel.type) {
            if (selectedModel.material.includes(object.name)) {
              object.material.color = new THREE.Color(
                "#" + selectedColor.value
              );
              object.material.side = 2;
              object.material.needsUpdate = true;
              object.castShadow = true;
            }
          } else {
            object.material.color = new THREE.Color("#" + selectedColor.value);
            object.material.side = 2;
            object.material.needsUpdate = true;
            object.castShadow = true;
          }
        }
      });

      tShirtMaterial.map = null;
      tShirtMaterial.color = new THREE.Color("#" + selectedColor.value);
      tShirtMaterial.needsUpdate = true;
    });
  });
}

/**
 * Handles the click event for the upload design button.
 * Finds the upload design button element and attaches a click event listener to it.
 * When the button is clicked, it triggers a click event on the hidden file input element.
 */
function uploadDesignBtnClick() {
  let uploadDesignbtn = document.querySelector("#uploadDesignbtn");
  // Add a data-attribute to store the current onclickvalue.
  uploadDesignbtn.onclick = "";
  uploadDesignbtn.removeEventListener("click", function () {});
  uploadDesignbtn.addEventListener(
    "click",
    function () {
      document.getElementById("myInput").click();
    },
    false
  );
  fileupload();
}

/**
 * Downloads a file from a base64 encoded string.
 * @param {string} contentType - The content type of the file.
 * @param {string} base64Data - The base64 encoded data of the file.
 * @param {string} fileName - The name of the file to be downloaded.
 */
function downloadBase64File(contentType, base64Data, fileName) {
  const linkSource = `data:${contentType};base64,${base64Data}`;
  const downloadLink = document.createElement("a");
  downloadLink.href = linkSource;
  downloadLink.download = fileName;
  downloadLink.click();
}

/**
 * Adds a click event listener to elements with the id "takeScreenshot" to take a screenshot
 * of the specified canvas element and download it as an image.
 */
function screenshotClick() {
  Array.from(document.querySelectorAll("#takeScreenshot")).forEach((e) => {
    // Add a data-attribute to store the current onclickvalue.
    e.onclick = "";
    e.addEventListener("click", function () {
      html2canvas(document.querySelector("#previewCanvas")).then(function (
        canvas
      ) {
        document.body.appendChild(canvas);
        var t = canvas.toDataURL().replace("data:image/png;base64,", "");
        downloadBase64File("image/png", t, "image");
      });
    });
  });
}

/**
 * Adds the 'active' class to the selected background and color elements.
 * The 'active' class is used to visually indicate the currently selected element.
 */
function activeBG() {
  document.querySelector("#" + selectedBg.id).classList.add("active");
  document
    .querySelector("#Colors_" + selectedColor.value)
    .classList.add("active");
}

/**
 * Adds click functionality to elements with the class "matclick".
 * Updates dataset attributes and applies active class on click.
 */
function backgroundClickFunction() {
  Array.from(document.querySelectorAll(".matclick")).forEach((e) => {
    // Add a data-attribute to store the current onclickvalue.
    e.dataset.Did = e.getAttribute("data-id"); // gets the attribute value.
    e.dataset.Durl = e.getAttribute("data-url");
    e.dataset.Dtype = e.getAttribute("data-type");
    e.dataset.Dcolor = e.getAttribute("data-color");
    e.onclick = "";
    e.addEventListener("click", function () {
      document.querySelector(".matclick.active")
        ? document.querySelector(".matclick.active").classList.remove("active")
        : "";
      this.classList.add("active");
      let Did = this.dataset.Did;
      let bgselect = bg.filter((x) => x.id === Did);
      selectedBg = bgselect[0];
      backgroundPreview.style.backgroundImage = "url(" + selectedBg.url + ")";
    });
  });
}

/**
 * Loads an HDR image and sets it as the environment map for the scene.
 * @param {string} path - The path to the HDR image file.
 * @returns None
 */
function hdrimapLoader(path) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  let rgbeloader = new RGBELoader(manager);
  rgbeloader.load(path, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
  });
}

hdrimapLoader(serverurl + "hdr/blocky_photo_studio_1k.hdr");

/**
 * Function to handle file upload functionality. It reads the file selected by the user,
 * uploads the design, and resets the file input value.
 */
function fileupload() {
  var fileToRead = document.getElementById("myInput");
  fileToRead.removeEventListener("change", function () {});
  fileToRead.addEventListener(
    "change",
    function (event) {
      var files = fileToRead.files;
      if (files.length) {
        var reader = new FileReader();
        reader.onload = function (e) {
          uploadDesign(e.target.result);
          fileToRead.value = null;
        };
        reader.readAsDataURL(files[0]);
      }
    },
    false
  );
}

/**
 * Animate
 */

const tick = () => {
  // Call tick again on the next frame
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();
