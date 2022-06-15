import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import retry from 'async-retry'
import FormData from 'form-data'
import { pipeline } from 'stream'
import { promisify } from 'util'

const THREADS = 1
const CHUNK = 20

const UPLOAD_URL = 'https://access2.imglarger.com:8998/upload'
const CHECK_URL = 'https://access2.imglarger.com:8998/status'
const RESULT_URL = 'http://get.imglarger.com:8889/results'

const HEADERS = {
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://imgupscaler.com',
    Referer: 'https://imgupscaler.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.99 Safari/537.36',
}

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
        timeout: 300000,
        headers: HEADERS
    })
    if (!uploadResponse.ok) {
        throw new Error(`${filename} : Error uploading`)
    }

    const uploadId = await uploadResponse.text()

    let status = 'waiting'
    while (status === 'waiting') {
        await new Promise(r => setTimeout(r, 1000));
        status = await retry(
            async () => {
                const response = await fetch(path.join(CHECK_URL, uploadId), { timeout: 300000, headers: HEADERS })

                if (!response.ok) {
                    throw new Error(`${filename} : error checking status`)
                }

                return await response.text()
            },
            {
                forever: true,
                onRetry: (err, attempt) => console.log(`${filename} : ${uploadId} : check retry ${attempt}. Cause: ${err.message}`)
            }
        )
        console.log(`${filename} : ${uploadId} : ${status}`)
    }

    if (status !== 'success') {
        throw new Error(`Upscale status: ${status}`)
    }

    const resultPath = path.join(__dirname, '../upscaled', path.parse(filename).name + '.jpg')

    await retry(async () => {
        console.log(`${filename} : ${uploadId} : downloading`)
        const resultFileStream = fs.createWriteStream(resultPath, { autoClose: true });

        const resultResponse = await fetch(path.join(RESULT_URL, uploadId + '_4x.jpg'), { headers: HEADERS });

        if (!resultResponse.ok) throw new Error(`unexpected response: ${resultResponse.statusText}`)

        await streamPipeline(resultResponse.body, resultFileStream)
    }, {
        forever: true
    })
}

const upscaleCollection = async (): Promise<void> => {
    const existingFiles = fs.readdirSync(path.join(__dirname, '../upscaled'))
    const files = fs.readdirSync(path.join(__dirname, '../images'))
        .filter((filename) => !existingFiles.includes(path.parse(filename).name + '.jpg'))
        .sort((a, b) => (+(path.parse(a).name)) - (+(path.parse(b).name)))

    const threads = _(files.map((item, i): [number, string] => [i, item]))
        .groupBy(([i, _item]): number => Math.ceil((i as number) % THREADS))
        .map((chunk) => chunk.map(([i, item]) => item))
        .value()

    await Promise.all(
        threads.map(async (_files) => {
            for (let i = 0; i < _files.length; i += CHUNK) {
                const chunk = _files.slice(i, i + CHUNK);

                await Promise.all(
                    chunk.map(async (filename) => await retry(
                        async () => await upscaleImage(filename),
                        { forever: true }
                    ))
                )
            }
        })
    )
}

upscaleCollection()