const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs/promises');
const readline = require('readline');

const url = process.argv[2];

if (!url) {
    console.log(`Please enter a URL (e.g. 'npm start https://howrare.is/sharkbros').`);
    process.exit(0);
}

const collectionName = url.substring(url.lastIndexOf('/') + 1);

(async() => {
    try {
        await fsPromises.access(collectionName)
        await fsPromises.rm(collectionName, { recursive: true });
    } catch (err) {
        console.log('folder does not exist, creating one...')
    }

    try {
        await fsPromises.mkdir(collectionName);
        console.log('new directory created')
    } catch (err) {
        console.log(err)
        console.log('error while creating the directory');
    }
})();

const collectionIndexes = {};

async function processCollectionIndexes() {
    console.log('reading the text file containg the collection data...');
    const fileStream = fs.createReadStream(`${collectionName}-collection-indexes.txt`);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const [key, value] = line.split(' ');
        collectionIndexes[key] = value;
    }

    console.log('file read successfully');
}

var numberOfPages = 0;

async function getNumberOfPages() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'load', timeout: 0 });

    const element = await page.waitForSelector('.pager>a:last-child');
    numberOfPages = Number(await element.evaluate(el => el.textContent));

    await browser.close();

    console.log(`number of pages to scan: ${numberOfPages}`);
}

getNumberOfPages()
    .then(() => processCollectionIndexes())
    .then(async() => {
        console.log('launching the browser instance...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        let currentPageIndex = 0;
        let numberOfImagesSavedPerPage = 0;

        page.on('response', response => {
            const url = response.url();
            if (response.request().resourceType() === 'image') {
                response.buffer().then(file => {
                    if (url.indexOf(`https://media.howrare.is/images/${collectionName}`) !== -1) {
                        const filePath = path.resolve(__dirname, collectionName, `${collectionIndexes[url]}.jpg`);
                        const writeStream = fs.createWriteStream(filePath);
                        writeStream.write(file);
                        numberOfImagesSavedPerPage++;
                        if (numberOfImagesSavedPerPage === 250) {
                            if (currentPageIndex < numberOfPages - 1) {
                                currentPageIndex++;
                                numberOfImagesSavedPerPage = 0;
                                switchPage(currentPageIndex);
                            }
                        }
                    }
                });
            }
        });

        await page.goto(`${url}/?page=${currentPageIndex}&ids=&sort_by=rank`, { waitUntil: 'load', timeout: 0 });

        async function switchPage(currentPageIndex) {
            await Promise.all([
                page.click(`a[href='/${collectionName}/?page=${currentPageIndex}&ids=&sort_by=rank']`),
                page.waitForNavigation({ waitUntil: 'load', timeout: 0 }),
            ]);
        }
    });