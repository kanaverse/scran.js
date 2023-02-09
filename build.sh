#!/bin/bash

set -e
set -u

mode=$(echo $1 | sed "s/\/$//")
if [ $mode != "browser" ] && [ $mode != "main" ]
then
    echo "need to specify 'browser' or 'main' as the first argument"
    exit 1
fi

# Copying over the Javascript files.
destdir=$mode
rm -rf ${destdir}
mkdir -p ${destdir}
cp js/*.js $destdir
cp -r js/internal $destdir

if [ $mode == "main" ]
then
    keep=node
else
    keep=web
fi

mkdir ${destdir}/abstract
to_rename=$(ls js/abstract/*_${keep}.js)
for x in ${to_rename[@]}
do
    newname=$(basename $x | sed "s/_${keep}\\.js$/.js/g")
    cp $x ${destdir}/abstract/$newname
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
    mkdir $builddir
    echo "{}" > $builddir/package.json # avoid assuming ES6 syntax for igraph config scripts.
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
