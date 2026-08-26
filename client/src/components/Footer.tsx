import { assets } from '../assets/assets';
import { footerLinks } from '../assets/dummy-data';
import { motion } from 'framer-motion';

export default function Footer() {

    return (
        <motion.footer className="bg-gray-50 border-t border-gray-200 pt-10 text-gray-600"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", duration: 0.5 }}
        >
            <div className="max-w-6xl mx-auto px-6">
                <div className="flex flex-col md:flex-row items-start justify-between gap-10 py-10 border-b border-gray-200">
                    <div>
                        <div className="inline-block bg-gray-900 rounded-lg px-3 py-2">
                            <img src={assets.logo} alt="logo" className="h-8" />
                        </div>
                        <p className="max-w-[410px] mt-6 text-sm leading-relaxed">
                            Create viral Reelmerce in seconds. Upload product images and a model photo, our AI instantly produces professional lifestyle imagery and short-form videos.
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-between w-full md:w-[45%] gap-5">
                        {footerLinks.map((section, index) => (
                            <div key={index}>
                                <h3 className="font-semibold text-base text-gray-900 md:mb-5 mb-2">
                                    {section.title}
                                </h3>
                                <ul className="text-sm space-y-1">
                                    {section.links.map(
                                        (link: { name: string; url: string }, i) => (
                                            <li key={i}>
                                                <a
                                                    href={link.url}
                                                    className="hover:text-gray-900 transition"
                                                >
                                                    {link.name}
                                                </a>
                                            </li>
                                        )
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="py-4 text-center text-sm text-gray-500">
                    © {new Date().getFullYear()} {' '}
                    <a href="https://prebuiltui.com/tailwind-templates?ref=pixel-forge">
                        Group Tec
                    </a>
                    . All rights reserved.
                </p>
            </div>
        </motion.footer>
    );
};