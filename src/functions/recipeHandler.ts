import { APIGatewayEvent } from 'aws-lambda';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import AWS from 'aws-sdk';

// Initialize the S3 client
const s3 = new AWS.S3();

// Modified zipContent function to handle multiple recipes
async function zipContent(recipes: { recipeName: string, data: Buffer }[]): Promise<Buffer> {
    const zip = archiver('zip', { zlib: { level: 9 } });
    const zipStream = new PassThrough();
    let chunks: Buffer[] = [];
    console.log('Zipping content...');
    zipStream.on('data', (chunk) => chunks.push(chunk));
    zipStream.on('end', () => {});

    zip.pipe(zipStream);

    // Loop through each recipe and append to the zip
    recipes.forEach(recipe => {
        zip.append(recipe.data, { name: `${recipe.recipeName}.paprikarecipe` });
    });

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
    const { recipes }  = JSON.parse(event.body);
    const recipesData = recipes.map((recipe: any) => ({
        recipeName: recipe.name,
        data: Buffer.from(JSON.stringify(recipe))
    }));

    try {
        const zipBuffer = await zipContent(recipesData);
        const s3Url = await uploadToS3(`RecipeBundle-${Date.now()}.paprikarecipes`, zipBuffer);
    
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
