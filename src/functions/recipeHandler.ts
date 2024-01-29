import { APIGatewayEvent } from 'aws-lambda';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import AWS from 'aws-sdk';

// Initialize the S3 client
const s3 = new AWS.S3();

// Helper function to zip content
async function zipContent(recipeName: string, data: Buffer): Promise<Buffer> {
    const zip = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();
    let chunks: Buffer[] = [];
    console.log('Zipping content...');
    zipStream.on('data', (chunk) => chunks.push(chunk));
    zipStream.on('end', () => {});

    zip.pipe(zipStream);
    zip.append(data, { name: `${recipeName}.paprikarecipe` });

    return new Promise((resolve, reject) => {
        zip.on('error', reject);
        zip.on('end', () => {
            console.log('Zipping complete - returning data');
            resolve(Buffer.concat(chunks));
        });
        zip.finalize();
    });
}

// Helper function to upload file to S3
async function uploadToS3(fileName: string, data: Buffer): Promise<string> {
    const params = {
        Bucket: process.env.RECIPE_BUCKET_NAME as string,
        Key: fileName,
        Body: data,
    };
    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location; // Returns the URL of the uploaded file
}

export async function preparePaprikaRecipe(event: APIGatewayEvent): Promise<{ statusCode: number; body: string }> {
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing request body' }),
        };
    }
    const requestBody = JSON.parse(event.body);
    const recipeName = requestBody.name;
    const data = Buffer.from(JSON.stringify(requestBody));

    try {
        const zipBuffer = await zipContent(recipeName, data);
        const s3Url = await uploadToS3(`${recipeName}.paprikarecipes`, zipBuffer);

        return {
            statusCode: 200,
            body: JSON.stringify({ url: s3Url }),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    }
};
