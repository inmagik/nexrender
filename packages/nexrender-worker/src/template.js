const { fetch: undiciFetch } = require("undici");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

const ORCHESTRATOR_URL =
    process.env.AUTOVIDEO_ORCHESTRATOR_URL ?? "http://127.0.0.1:8000";

const ORCHESTRATOR_SECRET = process.env.AUTOVIDEO_ORCHESTRATOR_SECRET ?? "";
const TEMPLATES_FOLDER =
    process.env.AUTOVIDEO_TEMPLATES_FOLDER ?? path.join(process.cwd(), "templates");

async function downloaAndUnzipTemplate(templateLabel, hash, url) {
    try {
        const r = await undiciFetch(url, {
            method: "GET",
        });
        if (!r.ok) {
            console.log(
                `Cannot download file from ${url}, status code`,
                r.status
            );
            console.log("Sserver response:");
            const text = await r.text();
            console.log(text);
        }

        const fileContent = await r.arrayBuffer();
        const buffer = Buffer.from(fileContent);
        //unzip the file to a folder named with the label
        const folderName = path.join(TEMPLATES_FOLDER, templateLabel);
        const zip = new AdmZip(buffer);
        if (fs.existsSync(folderName)) {
            fs.rmSync(folderName, { recursive: true });
        }
        fs.mkdirSync(folderName, { recursive: true });
        zip.extractAllTo(folderName, true);

        //WRITE CONTROL FILE
        const hashFile = path.join(folderName, `${hash}._hash`);
        fs.writeFileSync(hashFile, "");
        console.log("zip file extracted");
    } catch (e) {
        console.error(`Failed to contact the orchestrator server`);
        console.log(e);
    }
}

async function syncFiles(files) {
    for (const file of files) {
        const labelWithHash = file[0];
        const url = file[1];
        const [label, hash] = labelWithHash.split("___");

        const folderName = path.join(TEMPLATES_FOLDER, label);

        if (
            fs.existsSync(folderName) &&
            fs.existsSync(path.join(folderName, `${hash}._hash`))
        ) {
            console.log(`folder ${folderName} already exists, skipping`);
        } else {
            console.log(`folder ${folderName} does not exists, downloading`);
            await downloaAndUnzipTemplate(label, hash, url);
        }
    }
}

async function fetchAndRewriteTemplate(templateData) {
    const src = templateData.src;

    // check that source starts with prefix "kiuu-template://"
    if (!src.startsWith("kiuu-template://")) {
        return templateData;
    }

    // the template is something like 'kiuu-template://label_hash/filename'
    // get the label (without the filename)
    const base = src.replace("kiuu-template://", "");
    const templateLabel = base.split("/")[0];
    const fileSuffix = base.replace(`${templateLabel}`, "");

    try {
        const r = await undiciFetch(
            `${ORCHESTRATOR_URL}/api/or/kiuu-template/${templateLabel}/`,
            {
                method: "GET",
                headers: {
                    contentType: "application/json",
                    Authorization: `SyncVideo ${ORCHESTRATOR_SECRET}`,
                },
            }
        );
        if (!r.ok) {
            console.log(
                "Orchestrator server respond with bad status code:",
                r.status
            );
            console.log("Orchestrator server response:");
            const text = await r.text();
            console.log(text);
        }

        const files = await r.json();
        console.log("Orchestrator server response:", files);
        //sync files
        await syncFiles(files);
        console.log("files synched!");

        //rewrite the templateData
        templateData.src =
            "file://" +
            path.join(
                TEMPLATES_FOLDER,
                templateLabel.split("___")[0],
                fileSuffix
            );
        return templateData;
    } catch (e) {
        console.error(`Failed to contact the orchestrator server`);
        console.log(e);
    }
}

module.exports = { fetchAndRewriteTemplate };
