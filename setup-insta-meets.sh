#!/bin/bash

# Create a new Next.js project
echo "Creating a new Next.js project..."
npx create-next-app@latest insta-meets --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd insta-meets

# Install dependencies
echo "Installing dependencies..."
npm install @auth0/auth0-react socket.io-client simple-peer uuid
npm install @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-toast
npm install class-variance-authority clsx lucide-react next-themes tailwind-merge tailwindcss-animate

# Create shadcn/ui components
echo "Setting up shadcn/ui components..."
npx shadcn@latest init
npx shadcn@latest add avatar button card dialog dropdown-menu input label scroll-area separator toast

# Create .env.local file
echo "Creating .env.local file..."
cat > .env.local << EOL
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_AUTH0_DOMAIN=dev-q5303arr556nbtzi.jp.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=LdFta1zibLwjcB1irJlFDKkvdNUlNUYZ
EOL

# Start the development server
echo "Setup complete! Starting the development server..."
npm run dev