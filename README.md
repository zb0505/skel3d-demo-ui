# Skel3D demo app

This repo contains the UI code and server-side code required to run the Skel3D demo app.

## Building

### Building the server-side containers

Server-side code uses Apptainer, make sure the host has it installed.

Create a copy of `.env.example` in the `server` folder, rename it to `.env` and
make sure the assigned GPUs are correct for the models in the file.  
Then run these commands inside the `server` folder:

```bash
./install.sh
./start.sh
```

This will build the Apptainer container SIF files and start them as services.  
Make sure port 8000 is available externally, that is the default port for the main API.  
To modify the default port, edit the `.env` file.

### Building the UI

To build the UI, fill out the `.env` file based on the provided `.env.example` and run these commands:

```bash
npm install
npm run build
```

Once they complete, deploy the `dist` folder to any webhost.
