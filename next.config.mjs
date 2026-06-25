/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MVP uses arbitrary remote image URLs entered by sellers, so we render them
  // with a plain <img> tag rather than next/image to avoid domain allow-listing.
};

export default nextConfig;
