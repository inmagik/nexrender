const { fetch: undiciFetch } = require('undici')
const ORCHESTRATOR_URL =
  process.env.AUTOVIDEO_ORCHESTRATOR_URL ?? 'http://127.0.0.1:8000'

const ORCHESTRATOR_SECRET = process.env.AUTOVIDEO_ORCHESTRATOR_SECRET ?? ''
const TEMPLATES_FOLDER = process.env.AUTOVIDEO_TEMPLATES_FOLDER ?? ''

 async function fetchAndRewriteTemplate(templateData){

   const src = templateData.src

   // check that source starts with prefix "kiuu-template://"

    if (!src.startsWith('kiuu-template://')) {
        return templateData
    }

    // the template is something like 'kiuu-template://label/filename'
    // get the label (without the filename)
    const base = src.replace('kiuu-template://', '')
    const templateLabel = base.split('/')[0]
    const fileSuffix = base.replace(`${templateLabel}`, '')

    //#TODO: check if we already have the template on file system

    
    try {
        const r = await undiciFetch(
          `${ORCHESTRATOR_URL}/api/or/kiuu-template/${templateLabel}/`,
          {
            method: 'GET',
            headers: {
              contentType: 'application/json',
              Authorization: `SyncVideo ${ORCHESTRATOR_SECRET}`,
            }
          }
        )
        if (!r.ok) {
          console.log('Orchestrator server respond with bad status code:', r.status)
          console.log('Orchestrator server response:')
          const text = await r.text()
          console.log(text)
        }

        const files = await r.text()
        
        //#TODO: unzip the file to a folder named with the label
        
        console.log('Orchestrator server response:', files)

      } catch (e) {
        console.error(`Failed to contact the orchestrator server`)
        console.log(e)
      }



    
}

module.exports = { fetchAndRewriteTemplate }
