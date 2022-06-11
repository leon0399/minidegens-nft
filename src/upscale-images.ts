import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import retry from 'async-retry'
import FormData from 'form-data'
import { pipeline } from 'stream'
import { promisify } from 'util'

const CHUNK = 10

const UPLOAD_URL = 'https://access2.imglarger.com:8998/upload'
const CHECK_URL = 'https://access2.imglarger.com:8998/status'
const RESULT_URL = 'http://get.imglarger.com:8889/results'

const streamPipeline = promisify(pipeline)

const upscaleImage = async (filename: string): Promise<void> => {
    const filePath = path.join(__dirname, '../images/', filename)
    const fileStats = await fs.statSync(filePath);
    const fileSizeInBytes = fileStats.size;
    const fileStream = fs.createReadStream(filePath);

    const formData = new FormData()
    formData.append('myfile', fileStream, { knownLength: fileSizeInBytes });

    console.log(`${filename} : uploading`)
    const uploadResponse = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData,
        timeout: 60000
    })
    const uploadId = await uploadResponse.text()

    let status = 'waiting'
    while (status === 'waiting') {
        await new Promise(r => setTimeout(r, 1000));
        status = await retry(
            async () => await (await fetch(path.join(CHECK_URL, uploadId), { timeout: 2000 })).text(),
            {
                forever: true,
                onRetry: (err, attempt) => console.log(`Retry ${attempt}. Cause: ${err.message}`)
            }
        )
        console.log(`${filename} : ${uploadId} : ${status}`)
    }

    if (status !== 'success') {
        throw new Error(`Upscale status: ${status}`)
    }

    const resultPath = path.join(__dirname, '../upscaled', path.parse(filename).name + '.jpg')
    const resultFileStream = fs.createWriteStream(resultPath, { autoClose: true });

    const resultResponse = await fetch(path.join(RESULT_URL, uploadId + '_4x.jpg'));

    if (!resultResponse.ok) throw new Error(`unexpected response: ${resultResponse.statusText}`)

    await streamPipeline(resultResponse.body, resultFileStream)
}

const upscaleCollection = async (): Promise<void> => {
    const files = fs.readdirSync(path.join(__dirname, '../images'))

    // for (const filename of files) {
    //     await retry(
    //         async () => await upscaleImage(filename),
    //         {
    //             forever: true,
    //             onRetry: (err, attempt) => console.log(`Retry ${attempt}. Cause: ${err.message}`)
    //         }
    //     )
    // }

    // let currentFile = 0
    // while (currentFile < files.length) {
        
    // }

    for (let i = 0; i < files.length; i += CHUNK) {
        const chunk = files.slice(i, i + CHUNK);

        await Promise.all(
            chunk.map(async (filename) => await retry(
                async () => await upscaleImage(filename),
                { forever: true }
            ))
        )
    }
}

upscaleCollection()