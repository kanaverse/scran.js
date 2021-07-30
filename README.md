## Build wasm

```
# inside wasm

cmake .
make
```

## development

```
cd src
php -S localhost:7777
# then go to browser http://localhost:7777/app/index.html
```

## Building and running on localhost
# parcel currently has issues with wasm. waiting for wasm2 to come out
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

TODO:
- [ ] Need loading screens when waiting for worker to process
    - [ ] progress at each steps 
- [ ] Allow users to upload identities
    either by regular expression
    human - MT-
    mouse - mt-
- [ ] next button on every step
- [ ] better css layouts
    - steps on the top
    - left - description
    - center - content
    - right - optional ui input/settings
- [ ] QC: 
    - [ ] log y-axis on qc plots
    - [ ] 
- [ ] PCA: 
    - [ ] show % 
    - [ ] allow users to choose # of pcs
- [ ] 