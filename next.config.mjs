/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zyfkjxepykwpfzmkxitb.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'bahaymo.com',
      },
    ],
  },
}

export default nextConfig
