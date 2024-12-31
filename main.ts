// Import necessary modules
// Documentation: https://cliffy.io/docs@v1.0.0-rc.7/prompt
import { Select } from "jsr:@cliffy/prompt@1.0.0-rc.7";
// Documentation: https://cliffy.io/docs@v1.0.0-rc.7/command
import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
// Documentation: https://jsr.io/@std/path
import * as Path from "jsr:@std/path";

const offset = undefined;   // Can be used to skip already imported entries.
const maxEntries = 10;      // Can be used to limit the number of entries to import. Offset value is required.

function shouldSkip (idx: number) {
    if (offset && idx < offset) {
        return true;
    }
    const maxIndex = (offset && maxEntries) ? (offset + maxEntries) : undefined;
    if (maxIndex && idx >= maxIndex) {
        return true;
    }
    return false;
}

async function chooseGraph (apiToken: string) {
    // Send a request to the Reflect API to get the list of graphs
    const response = await fetch("https://reflect.app/api/graphs", {
        headers: {
            'Authorization': `Bearer ${apiToken}`
        }
    });
    console.log(response.status);
    if (response.status !== 200) {
        console.log(response.statusText);
        Deno.exit(response.status);
    }

    const jsonData = await response.json();

    const graphIds = jsonData.map((graph: {id: string}) => graph.id);
    const graphId: string = await Select.prompt({
        message: "Select which graph to import into",
        options: graphIds
    });

    return graphId;
}

async function getMapOfDailyNotes (notesDir: string) {
    const fileMapping = new Map<string, string>();

    // get files in local directory
    for await (const file of Deno.readDir(notesDir)) {
        if (!file.isFile) { continue; }

        // match file names with YYYYMMDD.md
        const match = file.name.match(/^([0-9]{4})([0-1]{1}[0-9]{1})([0-9]{2})\.md$/);
        if (match === null) { 
            console.log(`NOT MATCHED: ${file.name}`); 
            continue;
        }

        const year = match[1];
        const month = match[2];
        const day = match[3];
        
        // Reflect API expects ISO 8601 date format: YYYY-MM-DD
        const isoDate = `${year}-${month}-${day}`;

        // Get full file path
        const filePath = Path.join(notesDir, file.name);

        fileMapping.set(isoDate, filePath);
    }

    if (fileMapping.size === 0) {
        throw new Error("No matching file match supported date patterns");
    }
    console.log('The contents of these files will be imported into the matching daily entry:');
    fileMapping.keys().forEach((key, idx) => {
        if (shouldSkip(idx)) { return; }

        const filePath = fileMapping.get(key);
        console.log(`${filePath} --> ${key}`);
    });
    const confirm = await Select.prompt({
        message: "Proceed with the import?",
        options: ['yes', 'no']
    });
    if (confirm !== 'yes') {
        Deno.exit(0);
    }
    
    return fileMapping;
}

async function appendEntries (apiToken: string, graphId: string, fileMapping: Map<string, string>) {
    await fileMapping.keys().forEach(async (key, idx) => {
        if (shouldSkip(idx)) { return; }

        const filePath = fileMapping.get(key);
        if (!filePath) { throw new Error("Invalid file path"); }

        const fileContent = Deno.readTextFileSync(filePath);
        if (!fileContent) {
            console.warn(`Skipping empty file: ${filePath}`);
            return;
        }

        // Construct params for appending daily note (https://openpm.ai/packages/reflect)
        const params = {
            date: key,
            text: fileContent,
            transform_type: "list-append",
            list_name: "Imported"
        };
        const payload = {
            method: "PUT",
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params),
        };
        const response = await fetch(`https://reflect.app/api/graphs/${graphId}/daily-notes`, payload);
        if (response.status !== 200) {
            console.error(`Attempted to append using API payload:`);
            console.error(payload);
            throw new Error(`Failed to append daily note: ${response.statusText}`);
        }
        console.log(`Successfully imported: ${filePath}`);
    });
}

async function main (notesDir: string, apiToken: string) {
    //Check args
    if (!apiToken) {
        throw new Error("API token is required");
    }
    const stat = await Deno.stat(notesDir);
    if (!stat.isDirectory) {
        throw new Error(`${notesDir} is not a directory`);
    }

    const fileMapping = await getMapOfDailyNotes(notesDir);

    const graphId = await chooseGraph(apiToken);
    await appendEntries(apiToken, graphId, fileMapping);
}

if (import.meta.main) {
    await new Command()
        .name("deno -A main.ts")
        .description("Import daily note Markdown files into Reflect")
        .arguments("<notesDir:string> <apiToken:string>")
        .action(async (_options, ...args) => {
            await main(args[0], args[1]);
        })
        .parse(Deno.args);
}
