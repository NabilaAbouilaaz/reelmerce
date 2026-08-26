import {Request, Response } from 'express'
import * as Sentry from "@sentry/node";
import { prisma } from '../server.js';
import {v2 as cloudinary} from 'cloudinary'
import fal from '../configs/fal.js';
import sharp from 'sharp';

// While there's no paid AI provider set up yet, MOCK_GENERATION=true in .env
// makes generation instant and free by reusing existing media instead of
// calling a real model. Set it to false (or remove it) once fal.ai credits
// are added, and real generation takes over automatically.
const MOCK_GENERATION = process.env.MOCK_GENERATION === 'true';

export const createProject = async (req:Request, res: Response) => {
    let tempProjectId: string;
    const { userId } = req.auth();
    let isCreditDeducted = false;

const {name = 'New Project', aspectRatio, userPrompt, productName, productDescription, targetLength = 5} = req.body;

const images: any = req.files;
if(images.length < 2 || !productName){
    return res.status(400).json({message: 'Please upload at least 2 images'})
}

const user = await prisma.user.findUnique({
    where: {id: userId}
})

if(!user || user.credits < 5){
    return res.status(401).json({message: 'Insufficient credits'})
}else{
    // deduct credits for image generation
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {decrement: 5}}
    }).then(()=>{isCreditDeducted = true})
}
    try {
        let uploadedImages = await Promise.all(
    images.map(async (item: any) => {
        let result = await cloudinary.uploader.upload(item.path, 
            {resource_type: 'image'});
        return result.secure_url;
    })
)

const project = await prisma.project.create({
    data: {
        name,
        userId,
        productName,
        productDescription,
        userPrompt,
        aspectRatio,
        targetLength: parseInt(targetLength),
        uploadedImages,
        isGenerating:true
    }
})
 tempProjectId = project.id;

const prompt = `Combine the person and product into a realistic photo.
    Make the person naturally hold or use the product.
    Match lighting, shadows, scale and perspective.
    Make the person stand in professional studio lighting.
    Output ecommerce-quality photo realistic imagery.
    ${userPrompt}`

// Generate the image using fal.ai (Nano Banana Pro) — or a free instant
// stand-in while MOCK_GENERATION is on (see note above).
let generatedImageUrl: string | undefined;
if (MOCK_GENERATION) {
    // No paid AI provider yet: locally composite the product photo onto the
    // model photo (product image inset in a corner) so the "result" looks
    // like a combined shot instead of just an untouched upload.
    const [w, h] = aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];

    const modelBuffer = await sharp(images[1].path)
        .resize(w, h, { fit: 'cover' })
        .toBuffer();

    const productInset = await sharp(images[0].path)
        .resize(Math.round(w * 0.32))
        .extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#ffffff' })
        .toBuffer();

    const compositeBuffer = await sharp(modelBuffer)
        .composite([{ input: productInset, gravity: 'southeast' }])
        .png()
        .toBuffer();

    generatedImageUrl = `data:image/png;base64,${compositeBuffer.toString('base64')}`;
} else {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
        input: {
            prompt,
            image_urls: uploadedImages,
            aspect_ratio: aspectRatio || '9:16',
            safety_tolerance: '6' as const,
        },
    })
    generatedImageUrl = result?.data?.images?.[0]?.url;
}
if (!generatedImageUrl) {
    throw new Error('Failed to generate image');
}

const uploadResult = await cloudinary.uploader.upload(generatedImageUrl, {resource_type: 'image'});

await prisma.project.update({
    where: {id: project.id},
    data: {
        generatedImage: uploadResult.secure_url,
        isGenerating: false
    }
})
res.json({projectId:project.id})
 } catch (error:any) {
        if (tempProjectId!) {
    // update project status and error message
    await prisma.project.update({
        where: {id: tempProjectId},
        data: {isGenerating: false, error: error.message}
    })
}

if (isCreditDeducted) {
    // add credits back
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {increment: 5}}
    })
}
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}
export const createVideo = async (req:Request, res: Response) => {
    const {userId} = req.auth()
const { projectId } = req.body;
let isCreditDeducted = false;

const user = await prisma.user.findUnique({
    where: {id: userId}
})

if (!user || user.credits < 10) {
    return res.status(401).json({ message: 'Insufficient credits' });
}
// deduct credits for video generation
await prisma.user.update({
    where: {id: userId},
    data: {credits: {decrement: 10}}
}).then(() => { isCreditDeducted = true });
    try {
const project = await prisma.project.findUnique({
    where: {id: projectId, userId},
    include: {user: true}
})

if (!project || project.isGenerating) {
    return res.status(404).json({ message: 'Generation in progress' });
}

if (project.generatedVideo) {
    return res.status(404).json({ message: 'Video already generated' });
}
await prisma.project.update({
    where: {id: projectId},
    data: {isGenerating: true}
})

const prompt = `make the person showcase the product which is ${project.productName} ${project.productDescription && `and Product Description: ${project.productDescription}`}`

if (!project.generatedImage) {
    throw new Error('Generated image not found');
}

// Generate the video using fal.ai (Veo 3.1, image-to-video) — or a free
// instant stand-in while MOCK_GENERATION is on (see note above).
let generatedVideoUrl: string | undefined;
if (MOCK_GENERATION) {
    generatedVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
} else {
    const result = await fal.subscribe('fal-ai/veo3.1/image-to-video', {
        input: {
            prompt,
            image_url: project.generatedImage,
            aspect_ratio: (project?.aspectRatio === '16:9' ? '16:9' : '9:16') as '16:9' | '9:16',
            duration: '8s',
            resolution: '720p',
        },
    })
    generatedVideoUrl = result?.data?.video?.url;
}
if (!generatedVideoUrl) {
    throw new Error('Failed to generate video');
}

const uploadResult = await cloudinary.uploader.upload(generatedVideoUrl, { resource_type: 'video' });

await prisma.project.update({
    where: {id: project.id},
    data: {
        generatedVideo: uploadResult.secure_url,
        isGenerating: false
    }
})

res.json({message: 'Video generation completed', videoUrl: uploadResult.secure_url})

    } catch (error:any) {
// update project status and error message
await prisma.project.update({
    where: {id: projectId, userId},
    data: {isGenerating: false, error: error.message}
})

if (isCreditDeducted) {
    // add credits back
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {increment: 10}}
    })
}

        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}

export const getAllPublishedProjects = async (req:Request, res: Response) => {
    try {
    const projects = await prisma.project.findMany({
        where: {isPublished: true}
    })
    res.json({projects})

} catch (error: any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}
export const deleteProject = async (req:Request, res: Response) => {
    try {
const { userId } = req.auth();
const { projectId } = req.params;

const project = await prisma.project.findUnique({
    where: {id: projectId, userId}
})

if (!project) {
    return res.status(404).json({ message: 'Project not found' });
}
await prisma.project.delete({
    where: {id: projectId}
})

res.json({ message: 'Project deleted' });
    } catch (error:any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}