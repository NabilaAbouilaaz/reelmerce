import { Loader2Icon, RectangleHorizontalIcon, RectangleVerticalIcon, Wand2Icon } from "lucide-react";
import Title from "../components/Title";
import UploadZone from "../components/UploadZone";
import { useState } from "react";
import { PrimaryButton } from "../components/Buttons";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../configs/axios";

const Generator = () => {
         const {user}= useUser()
         const {getToken}= useAuth()
         const navigate = useNavigate()

         const [name,setName] = useState('')
         const [productName,setProductName] = useState('')
         const [productDescription,setProductDescription] = useState('')
         const [aspectRatio,setAspectRatio] = useState('9:16')
         const [productImage,setProductImage] = useState<File | null>(null)
         const [modelImage,setModelImage] = useState<File | null>(null)
         const[userPrompt,setUserPrompt] = useState('')
         const[isGenerating,setIsGenerating] = useState(false)

         const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type:
            'product' | 'model') => {
                if(e.target.files && e.target.files[0]) {
                    if(type === 'product') setProductImage(e.target.files[0]);
                    else setModelImage(e.target.files[0])

            }} 
        
        const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if(!user) return toast('Please login to generate')

if(!productImage || !modelImage || !name || !productName || !aspectRatio)
    return toast('Please fill all the required fields')
   try {
  setIsGenerating(true);
  const formData = new FormData();

  formData.append('name', name)
  formData.append('productName', productName)
  formData.append('productDescription', productDescription)
  formData.append('userPrompt', userPrompt)
  formData.append('aspectRatio', aspectRatio)
  formData.append('images', productImage)
  formData.append('images', modelImage)

    const token = await getToken()

const { data } = await api.post('/api/project/create', formData, {
    headers: { Authorization: `Bearer ${token}` }
})

toast.success(data.message)
navigate('/result/' + data.projectId)
 }catch (error: any) {
  setIsGenerating(false);
  toast.error(error?.response?.data?.message || error.message)
}
}
    return (
        <div className="min-h-screen text-gray-900 p-6 md:p-12 mt-28">
            <form onSubmit={handleGenerate} className="max-w-4xl mx-auto mb-40">
                <Title heading="Generate In-Context Image"  description="Upload your model and product images to generate stunning Reelmerce, short-form videos and social media posts." />
<div className="flex gap-20 max-sm:flex-col items-start justify-between">
    {/*Left Col*/}
    <div className="flex flex-col w-full sm:max-w-60 gap-8 mt-8 mb-16">
        <UploadZone label="Product Image" file={productImage} onClear={() => setProductImage(null)} onChange={(e) => handleFileChange(e, 'product')} />
        <UploadZone label="Model Image" file={modelImage} onClear={() => setModelImage(null)} onChange={(e) => handleFileChange(e, 'model')} />
    </div>
    {/*Right Col*/}
     <div className="w-full">
        <div className="mb-4 text-gray-700">
            <label htmlFor="name" className="block text-sm mb-4">Project Name</label>
            <input type="text" id="name"  value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your project" required className="w-full bg-gray-50 rounded-lg border-2 p-4 text-sm border-gray-300 focus:border-green-500/50 outline-none transition-all" />
        </div>
        <div className="mb-4 text-gray-700">
            <label htmlFor="productName" className="block text-sm mb-4">Product Name</label>
            <input type="text" id="productName"  value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Name your product" required className="w-full bg-gray-50 rounded-lg border-2 p-4 text-sm border-gray-300 focus:border-green-500/50 outline-none transition-all" />
        </div>
        <div className="mb-4 text-gray-700">
            <label htmlFor="productDescription" className="block text-sm mb-4">Product Description<span className="text-xs text-green-400"> (optional)</span></label>
            <textarea id="productDescription" rows={4} value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Describe your product" className="w-full bg-gray-50 rounded-lg border-2 p-4 text-sm border-gray-300 focus:border-green-500/50 outline-none transition-all" />
        </div>
         <div className="mb-4 text-gray-700">
            <label className="block text-sm mb-4">Aspect Ratio</label>
            <div className="flex gap-3"> 
               <RectangleVerticalIcon onClick={() => setAspectRatio('9:16')} className={`p-2.5 size-13 bg-gray-100 rounded transition-all ring-2 ring-transparent cursor-pointer ${aspectRatio === '9:16' ? 'ring-green-500/50 bg-gray-200' : ''}`} />
               <RectangleHorizontalIcon onClick={() => setAspectRatio('16:9')} className={`p-2.5 size-13 bg-gray-100 rounded transition-all ring-2 ring-transparent cursor-pointer ${aspectRatio === '16:9' ? 'ring-green-500/50 bg-gray-200' : ''}`} />

                </div>

            </div>
             <div className="mb-4 text-gray-700">
            <label htmlFor="userPrompt" className="block text-sm mb-4">User Prompt</label>
            <input type="text" id="userPrompt"  value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Describe what you want to create" required className="w-full bg-gray-50 rounded-lg border-2 p-4 text-sm border-gray-300 focus:border-green-500/50 outline-none transition-all" />
        </div>

    </div>
</div>
<div className="flex justify-center mt-10">
    <PrimaryButton disabled={isGenerating} className="px-10 py-3 rounded-md disabled:opacity-70 disabled:cursor-not-allowed">
        {isGenerating ?  (
            <>
            <Loader2Icon className="size-5 animate-spin" />Generating...  
            </>

        ) : (
            <>
            <Wand2Icon className="size-5"/>Generate Image
            </>

        )}



    </PrimaryButton>
    

</div>

            </form>
        </div>
    );
}
export default Generator;