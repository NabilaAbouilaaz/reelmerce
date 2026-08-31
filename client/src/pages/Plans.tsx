import Pricing from "../components/Pricing";

const Plans = () => {
  return (
    <div className="max-sm:py-10 sm:pt-20">
      <Pricing />

      <p className="text-center text-gray-500 max-w-md text-sm mt-14 mb-4 mx-auto px-12">Create stunning images for just <span className='text-green-600 font-medium'>5 credits</span>  and generate immersive videos for <span className='text-green-600 font-medium'>10 credits</span>.</p>

      <p className="text-center text-gray-400 max-w-md text-xs mb-14 mx-auto px-12">
        Demo mode — no real charge. Use test card <span className="font-medium text-gray-500">4242&nbsp;4242&nbsp;4242&nbsp;4242</span>, any future expiry, any CVC.
      </p>
    </div>
  )
}

export default Plans;