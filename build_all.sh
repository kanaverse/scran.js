# build the node version
bash build.node.sh

# remove the build directory just in case
rm -rf build

# build normal version
bash build.sh
