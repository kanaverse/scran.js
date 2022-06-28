#!/bin/bash

set -e
set -u

mode=$(echo $1 | sed "s/\/$//")
if [ $mode != "module" ] && [ $mode != "main" ]
then
    echo "need to specify 'module' or 'main' as the first argument"
    exit 1
fi

# Copying over the Javascript files.
destdir=$mode
rm -rf ${destdir}
mkdir -p ${destdir}
cp js/*.js $destdir
cp -r js/internal $destdir
cp -r js/abstract $destdir

# Environment-specific handling.
if [ $mode != "main" ]
then
    cat js/wasm.js | grep -v "NODE ONLY" > $destdir/wasm.js
fi

if [ $mode == "main" ]
then
    toss=web
    keep=node
else
    toss=node
    keep=web
fi
rm ${mode}/abstract/*_${toss}.js

to_rename=$(ls ${mode}/abstract/*_${keep}.js)
for x in ${to_rename[@]}
do
    newname=$(echo $x | sed "s/_${keep}\\.js$/.js/g")
    mv $x $newname
done

# Building the Wasm files.
builddir=build_$mode
if [ $mode == "main" ]
then
    node_flag=ON
else
    node_flag=OFF
fi

if [ ! -e $builddir ]
then
    emcmake cmake -S . -B $builddir -DCOMPILE_NODE=${node_flag} -DCMAKE_BUILD_TYPE=Release
fi

cd $builddir
emmake make

final=../${destdir}/wasm
mkdir -p ${final}
cp -r scran.* ${final}

if [ $mode == "main" ]
then
    # For easier testing.
    mkdir -p ../js/wasm
    cp -r scran.* ../js/wasm
fi
