import fs from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'
import retry from 'async-retry'

const URL = 'https://bf.dallemini.ai/generate'
const QUERY = 'nft'

interface Response {
    images: string[]
    version: string
}

const loadBatch = async (): Promise<string[]> => {
    const response = await fetch(URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: QUERY }),
    })

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const data = await response.json() as Response;

    return data.images
}

const saveBatch = async (images: Record<number, string>) => {
    Object.entries(images).forEach(async ([number, content]) => {
        await fs.writeFile(path.join(__dirname, `../images/${number}.png`), content, { encoding: 'base64' })
    });
}

const createCollection = async (size: number) => {
    const startTime = Date.now()
    let current = 0

    while (current < size) {
        console.log(`Loading batch: ${current}`)
        const images = await retry(
            async () => await loadBatch(),
            {
                retries: 100,
                maxTimeout: 60000,
                onRetry: (err, attempt) => console.log(`Retry ${attempt}. Cause: ${err.message}`)
            },
        );
        await saveBatch(Object.fromEntries(images.map((image, index) => [current + index, image])))

        current += images.length
        const perImageTime = (Date.now() - startTime) / current
        const eta = Date.now() + (size - current) * perImageTime

        console.log("ETA: " + new Date(eta).toISOString())
    }
}

createCollection(9999)