import { PricingTable } from '@clerk/clerk-react';
import Title from './Title';


export default function Pricing() {
    return (
        <section id="pricing" className="py-20 bg-gray-50 border-t border-gray-200">
            <div className="max-w-6xl mx-auto px-4">

                <Title
                    title="Pricing"
                    heading="Pricing Plans"
                    description="Our pricing plans are simple, transparent and flexible. Choose the plan that best suits your needs."
                />

               <div className="flex flex-wrap items-center justify-center max-w-5xl mx-auto">
    <PricingTable appearance={{
      variables: {
          colorBackground: 'none'
      },
      elements: {
          pricingTableCardBody: 'bg-white border border-gray-200',
          pricingTableCardHeader: 'bg-gray-50',
          switchThumb: 'bg-white'
      }
    }}/>
</div>
            </div>
        </section>
    );
};