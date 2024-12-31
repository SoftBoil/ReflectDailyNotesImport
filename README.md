# Import daily note Markdown files into Reflect

This is a Deno application that takes existing daily notes markdown files and appends then to the daily notes in Reflect Notes. For example, I used this to import my calendar files from Noteplan into Reflect Notes.

## How to Run

1. Make sure you have Deno installed. If not, you can install it from [deno.land](https://deno.land/).
2. Clone this repository or download the files.
3. Open a terminal and navigate to the project directory.
4. Run the application using the following command:
   
   ```bash
   deno run --allow-net --alow-read main.ts <notesDir> <apiToken>
   ```
   
### notesDir

This is the directory containing all the Markdown files to import. Each file to import should be named like this: YYYYMMDD.md

### apiToken

Follow the instructions [here](https://reflect.academy/api) to create an access token. You need to type something for the "domain" and "Redirect URIs" but these are only necessary for OAuth. We will just be using the access token. Click "Generate access token" to create one.