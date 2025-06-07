# Swiss Ephemeris WebAssembly Build
# Optimized for single-file deployment with all ephemeris data embedded

CC = emcc
CFLAGS = -Wall -fPIC -O2 -DUSECASE=2 -I../sweph/src
CFLAGS_RELEASE = -Wall -fPIC -O3 -DUSECASE=2 -DNDEBUG -I../sweph/src
LIBS = -lm -ldl

# Default target
all: astro-embedded

# Object files
astro.o: astro.c
	$(CC) $(CFLAGS) -c astro.c -o astro.o

astro-release.o: astro.c
	$(CC) $(CFLAGS_RELEASE) -c astro.c -o astro-release.o

# Swiss Ephemeris library
libswe.a:
	$(MAKE) -C ../sweph/src libswe.a CC="$(CC)" CFLAGS="$(CFLAGS)"
	cp ../sweph/src/libswe.a .

libswe-release.a:
	$(MAKE) -C ../sweph/src libswe.a CC="$(CC)" CFLAGS="$(CFLAGS_RELEASE)"
	cp ../sweph/src/libswe.a libswe-release.a

# Single file embedded build (RECOMMENDED)
# Embeds all 49 ephemeris files into a single JavaScript file with maximum compression
astro-embedded: astro-release.o libswe-release.a
	@echo "Building ultra-compressed single file with all ephemeris files embedded..."
	@echo "Ephemeris data size: $$(du -sh eph/)"
	@echo "Embedding $$(find eph -name "*.se1" | wc -l) ephemeris files..."
	$(CC) $(CFLAGS_RELEASE) astro-release.o \
		$(shell find eph -name "*.se1" -exec echo "--embed-file {}" \;) \
		-o astro-embedded.js \
		-s WASM=1 -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
		-s EXPORTED_FUNCTIONS='["_test", "_get", "_getPlanets", "_getHouses", "_degreesToDMS", "_getJulianDay", "_getPlanet", "_getPlanetaryNodes", "_getSinglePlanetNodes", "_getAsteroids", "_getSpecificAsteroids", "_setEphemerisPath", "_getEphemerisInfo", "_freeMemory", "_malloc", "_free"]' \
		-s WASM_ASYNC_COMPILATION=0 \
		-s FORCE_FILESYSTEM=1 -s SINGLE_FILE=1 \
		-O1 \
		-s TEXTDECODER=0 \
		-s ABORTING_MALLOC=0 \
		-s ALLOW_MEMORY_GROWTH=0 \
		-s INITIAL_MEMORY=67108864 \
		-s STACK_SIZE=1048576 \
		-s NO_EXIT_RUNTIME=1 \
		-s ASSERTIONS=0 \
		-s DISABLE_EXCEPTION_CATCHING=1 \
		-s FILESYSTEM=1 \
		-s SUPPORT_LONGJMP=0 \
		-s LZ4=1 \
		-L. -lswe-release $(LIBS)
	@echo "✅ Ultra-compressed single file build complete:"
	@ls -lh astro-embedded.js
	@echo "✅ No separate .wasm or .data files needed"
	@echo "✅ Ready for deployment"



# Install to js directory
install: astro-embedded
	@echo "Installing to js directory..."
	mv astro-embedded.js ../../js/
	@echo "✅ Installed: js/astro-embedded.js ($$(du -sh ../../js/astro-embedded.js | cut -f1))"



# Development build (for testing, creates separate files)
astro-dev: astro.o libswe.a
	@echo "Building development version..."
	$(CC) $(CFLAGS) --preload-file eph -o astro-dev.js astro.o \
		-s WASM=1 -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
		-s FORCE_FILESYSTEM=1 -L. -lswe $(LIBS)
	@echo "Development build complete (separate .js/.wasm/.data files)"

# Clean build artifacts
clean:
	rm -f *.o *.a *.js *.wasm *.data *.br *.xz
	rm -rf eph-*

# Show build information
info:
	@echo "=== Swiss Ephemeris WASM Build Information ==="
	@echo "Ephemeris files: $$(find eph -name "*.se1" | wc -l)"
	@echo "Ephemeris size: $$(du -sh eph/)"
	@echo ""
	@echo "Available targets:"
	@echo "  astro-embedded       - Single file with all ephemeris data (RECOMMENDED)"
	@echo "  astro-dev           - Development build with separate files"
	@echo "  install             - Install embedded version to js/"
	@echo "  clean               - Clean build artifacts"
	@echo "  info                - Show this information"

.PHONY: all install clean info 