const puppeteer = require('puppeteer');
const fsPromises = require('fs/promises');

const url = process.argv[2];

if (!url) {
    console.log(`Please enter a URL (e.g. 'npm start https://howrare.is/sharkbros').`);
    process.exit(0);
}

const collectionName = url.substring(url.lastIndexOf('/') + 1);

(async() => {
    try {
        await fsPromises.rm(`${collectionName}-collection-indexes.txt`);
    } catch (err) {
        // error occurrs when file doesn't exist, since it's trying to access non existing file
    }

    // in both cases new file will be created
    console.log('creating file for storing collection data...');
})();

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
    .then(async() => {
        console.log('launching the browser instance...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        let currentPageIndex = 0;

        console.log('collecting data in progress, this might take long(up to 10 mins) depending on the size of the collections and internet speed...');
        await page.goto(`${url}/?page=${currentPageIndex}&ids=&sort_by=rank`, { waitUntil: 'load', timeout: 0 });
        await getCollectionIndexesFromCurrentPage();

        async function getCollectionIndexesFromCurrentPage() {
            const collectionIndexesElements = await page.$$('.item_stats>div:nth-child(2)>span');
            const imageElements = await page.$$('.featured_item_img>a>img');

            await Promise.all(
                collectionIndexesElements.map((element, idx) => {
                    const collectionIndex = element.evaluate(el => el.textContent.substring(1));
                    const imageUrl = imageElements[idx].evaluate(el => el.src);

                    let contentToWrite = '';
                    imageUrl
                        .then(text => {
                            contentToWrite += text
                        })
                        .then(() => {
                            collectionIndex.then(text => contentToWrite += ` ${text}`)
                        })
                        .then(() => fsPromises.appendFile(`${collectionName}-collection-indexes.txt`, `${contentToWrite}\n`));
                })
            );

            currentPageIndex++;

            if (currentPageIndex < numberOfPages) {
                await switchPage(currentPageIndex);
            } else {
                await browser.close();
                console.log('collection data collected.');
            }
        }

        async function switchPage(currentPageIndex) {
            await Promise.all([
                page.click(`a[href='/${collectionName}/?page=${currentPageIndex}&ids=&sort_by=rank']`),
                page.waitForNavigation({
                    waitUntil: 'load',
                    timeout: 0
                }),
            ]);

            await getCollectionIndexesFromCurrentPage();
        }
    });