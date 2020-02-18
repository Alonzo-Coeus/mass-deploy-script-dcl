let deployManifest = require("./manifest.json");
let ncp = require("ncp").ncp;
let replaceStream = require('replacestream');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fsp = require('fs').promises;
let async = require('async');

function copyTemplate(x,y)
{
   return new Promise((res,rej)=>{
       ncp("./template/", `./tmp/${x},${y}/`, {transform: applyStreamingTemplates({'x':x,'y':y})}, (err)=>{
            if (err) {rej(err)};
            res();
        })
    });
}

function runStringTemplate(template_string, params)
{
    var tmp = template_string;
    for(let prop in params) {
        var tmp = tmp.replace(`%${prop}`, params[prop]);
    }
    return tmp;
}

async function deployScene (dir)
{
    const { stdout, stderr } = await exec(`dcl deploy`, {
        "cwd": dir
    });
    if (stderr) {console.error(stderr);}
    if (stdout) {console.log(stdout);}
    await exec(`rm -rf ${dir}`);
}

function applyStreamingTemplates (params)
{
    return function (read, write) {
        var tmp = read;
        for (let prop in params) {
            tmp = tmp.pipe(replaceStream(`%${prop}`,params[prop]));
        }
        tmp.pipe(write);
    }
}

async function buildNewScene (x, y, modelPath)
{
    let templatedModelPath = runStringTemplate(modelPath, {X:x,Y:y});

    await copyTemplate(x, y);
    console.log(`Copyed ${x},${y}`);
    if (templatedModelPath) {
        await fsp.copyFile(templatedModelPath, `./tmp/${x},${y}/models/SCENE.glb`)
    }
}

async function getPlotList ()
{
    let fileObjects = await fsp.readdir(deployManifest.modelPath, {withFileTypes: true});
    let files = fileObjects.map(x => x.name);

    let cordExtract = (str) => { // limits files to have x and y as the only numbers. Could be replaced with matching on the template
        let matches = str.match(/\d+/g);
        let castedMatches = matches.map(numStr => parseInt(numStr)); // Truthyness bug causes map(parseInt) to break
        if (matches.length != 2) {throw Error("Models directory is poluted!")};
        return {x: castedMatches[0], y: castedMatches[1]};
    }

    let cordList = files.map(cordExtract);
    return cordList;
}

async function main ()
{
    if(!process.env.DCL_PRIVATE_KEY) {console.error("No enviroment variable DCL_PRIVATE_KEY set!"); return;}
    let completeModelPath = deployManifest.modelPath + deployManifest.modelFile;
    let plotList = await getPlotList();
    let deployQueue = async.queue(async (plotCord) => {
        let x = plotCord.x;
        let y = plotCord.y;
        let path = `./tmp/${x},${y}/`;

        await buildNewScene(plotCord.x, plotCord.y, completeModelPath);
        await deployScene(path);
    }, deployManifest.concurrency);
    plotList.forEach(plotCord => {
        deployQueue.push(plotCord);
    });
}

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

main();
