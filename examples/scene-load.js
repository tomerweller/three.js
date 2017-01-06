/**
 * Created by weller on 1/3/17.
 */


const loader = new THREE.ObjectLoader();
let camera, renderer, stats, scene, ball, floor, light, ballGeometry, floorGeometry;

const initScene = loadedScene => {
    scene = loadedScene;
    ball = scene.getObjectByName("Ball");
    ball.material.side = THREE.DoubleSide;
    ballGeometry = new THREE.Geometry().fromBufferGeometry(ball.geometry);
    floor = scene.getObjectByName("Floor");
    floorGeometry = new THREE.Geometry().fromBufferGeometry(floor.geometry);
    light = scene.getObjectByName("PointLight");

    console.log("scene loading...");
    console.log(scene);

    const container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 2000 );
    camera.position.set( 0.0, 10, 10 * 3.5 );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    stats = new Stats();
    container.appendChild( stats.dom );
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0, 0 );
    controls.update();

    animate();
};

const onWindowResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize( width, height );
};

const animate = () => {
    requestAnimationFrame( animate );
    stats.begin();
    render();
    stats.end();
};

const render = () => {
    //modify state
    // calcNew();
    renderer.render( scene, camera );
};

const vector3FromArr = arr => new THREE.Vector3(arr[0],arr[1],arr[2]);
const vertexIterator = mesh => { //for meshes with buffered geometry
    const iterable = {};
    iterable[Symbol.iterator] = function* () {
        const vertexCount = mesh.geometry.attributes.normal.count;
        const normalArr = mesh.geometry.attributes.normal.array;
        const positionArr = mesh.geometry.attributes.position.array;
        for (let i=0; i<vertexCount; i++) {
            const projectedI = i*3;
            yield {
                normal: vector3FromArr(normalArr.subarray(projectedI,projectedI+3)),
                position: vector3FromArr(positionArr.subarray(projectedI,projectedI+3)),
            }
        }
    };
    return iterable;
};
const raycaster = new THREE.Raycaster();
const raycast = (origin, direction, mesh) => {
    raycaster.set(origin, direction);
    return raycaster.intersectObject(mesh);
};

const hashVertex = v => `${v.position.x},${v.position.y},${v.position.z},${v.normal.x},${v.normal.y},${v.normal.z}`;
const distinctVertices = arr => {
    //filter to unique positions
    const mem = new Set();
    return arr.filter(v => {
        const hash = hashVertex(v);
        if (mem.has(hash)) {
            return false;
        } else {
            mem.add(hash);
            return true;
        }
    });
};


const RINDEX_AIR = 1;
const RINDEX_GLASS = 1.52;
const EQUALITY_THRESHEOLD = 0.01;

const deg = (rad) => rad*(180/Math.PI);

const log = console.log;
const refract = (surfaceNormal, inRay, inIOR, outIOR) => {
    const theta1 = surfaceNormal.clone().angleTo(inRay); //+
    // console.log("theta1 is", deg(theta1));
    const refractAngle = Math.asin((inIOR/outIOR)*Math.sin(theta1)); //+
    // console.log("refract angle", deg(refractAngle));
    const reverseSurfaceNormal = surfaceNormal.clone().multiplyScalar(-1);
    // console.log("reverse surface normal", reverseSurfaceNormal);
    const rotationAxis = surfaceNormal.clone().cross(inRay).normalize();
    // console.log("rotation axis is", rotationAxis);
    const out = reverseSurfaceNormal.clone().applyAxisAngle(rotationAxis, refractAngle);
    // console.log("out", out);
    return out;
};

const testRefract1 = () => refract(new THREE.Vector3(0,1,0), new THREE.Vector3(0.5,0.866,0), 1, 1.5);
const testRefract2 = () => refract(new THREE.Vector3(0,1,0), new THREE.Vector3(-0.5,0.866,0), 1, 1.5);
const testRefract4 = () => refract(new THREE.Vector3(0,-1,0), new THREE.Vector3(0.5,-0.866,0), 1, 1.5);
const testRefract5 = () => refract(new THREE.Vector3(0,-1,0), new THREE.Vector3(-0.5,-0.866,0), 1, 1.5);

const vTest = {
    normal: new THREE.Vector3(0,1,0),
    position: new THREE.Vector3(0,1.5,0)
};



//pseudo code
//l is light source
//for v in refractive vertices:
//  ln = vector between l and v
//  isects1 = raycast from l in ln with refractive mesh.
//  if first hit is v:
//    rn = refract normal
//    v2 = raycast from v in rn with refractive mesh
//    fn = refract rn from v2
//    raycast fn with receptive mesh

const calcLightDestination = (v) => {

    log(v);
    const v1globalPos = v.position.clone().add(ball.position);
    const ln = v1globalPos.clone().sub(light.position).normalize();
    const isecs = raycast(light.position, ln, ball);
    // console.log(isecs);
    // isecs.forEach((isec,i) => console.log(`${i}:${isec.distance}`));
    // console.log(v.position);
    if (isecs.length>0 && isecs[0].point.distanceTo(v1globalPos)<EQUALITY_THRESHEOLD){
        const out = refract(v.normal, ln.clone().multiplyScalar(-1), RINDEX_AIR, RINDEX_GLASS);
        console.log("out", out);
        const inIsecs = raycast(v1globalPos, out, ball);
        inIsecs
        // .filter(isec => isec.distance>EQUALITY_THRESHEOLD)
            .forEach((isec,i) => console.log(`${i}:${isec.distance}`));
        const firstRemoteIsec = inIsecs.find(isec => isec.distance>EQUALITY_THRESHEOLD);
        console.log("second intersection", firstRemoteIsec);
    }
};

const calc = () => {
    const allVertices = [... vertexIterator(ball)];
    const uniqueVertices = distinctVertices(allVertices);
    log("all/unique", allVertices.length, uniqueVertices.length);
    uniqueVertices.forEach(calcLightDestination);
    return "done";
};

const projectFacesBallBall = (f) => {
    //face vertices, global

    const vertices = [f.a, f.b, f.c].map(v => {
        const position = ballGeometry.vertices[v].clone().add(ball.position);
        return {
            position,
            inLightDirection: position.clone().sub(light.position).normalize()
        }
    });

    const isFaceDirect = vertices.reduce((isTrue, v) => {
        const isecs = raycast(v.position, v.inLightDirection, ball);
        return isTrue && isecs.length>0 && isecs[0].point.distanceTo(v.position)<EQUALITY_THRESHEOLD;
    }, true);

    let faceProjections = [];

    if (isFaceDirect) {
        faceProjections = vertices.reduce( (prev, v) => {
            const ray = refract(f.normal, v.inLightDirection.clone().multiplyScalar(-1), RINDEX_AIR, RINDEX_GLASS);
            const isecs = raycast(v.position, ray, ball);
            //we might only care about the furthest but taking all for now
            const filteredIsecs = isecs.filter(isec => isec.distance>EQUALITY_THRESHEOLD);
            return prev.concat(filteredIsecs.map(isec => ({face: isec.face, ray})));
        }, []);
    }

    return faceProjections;
};

const testCalcFace = () => projectFacesBallBall(ballGeometry.faces[0]);

const projectFacesBallWall = pf => {

    const vertices = [pf.face.a, pf.face.b, pf.face.c]
        .map(v => ballGeometry.vertices[v].clone().add(ball.position));

    const faceProjections = vertices.reduce( (prev, v) => {
        const ray = refract(pf.face.normal, pf.ray.clone().multiplyScalar(-1), RINDEX_GLASS, RINDEX_AIR);
        const isecs = raycast(v, ray, floor);
        //we might only care about the furthest but taking all for now
        return prev.concat(isecs);
    }, []);

    return faceProjections;
};

const calcNew = () => {
    const ballBallFaces = ballGeometry.faces.reduce((prev, f) => {
        return prev.concat(projectFacesBallBall(f));
    }, []);

    const ballFloorFaces =  ballBallFaces.reduce((prev, projectedFace) => {
        return prev.concat(projectFacesBallWall(projectedFace));
    }, []);

    // console.log(ballFloorFaces);

    const cousticMap = {};
    ballFloorFaces.forEach(f => {
        if (!(f.faceIndex in cousticMap)){
            cousticMap[f.faceIndex] = 0;
        }
        cousticMap[f.faceIndex]+=1;
    });

    // console.log(cousticMap);


    return "done"
};



loader.load( "scene.json", initScene);
window.addEventListener( 'resize', onWindowResize, false );
