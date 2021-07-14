## Build wasm

```
# inside wasm

emcmake cmake -S . -B build
cd build
emmake make
```

## Building and running on localhost

First install dependencies:

```sh
npm install
```

To run in hot module reloading mode:

```sh
npm start
```

To create a production build:

```sh
npm run build-prod
```

## Running

```sh
node dist/bundle.js
```