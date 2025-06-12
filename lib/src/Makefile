# Swiss Ephemeris WebAssembly Build System
# Optimized for single-file deployment with embedded ephemeris data
#
# This Makefile builds the Swiss Ephemeris library as a WebAssembly module
# with all ephemeris files embedded for standalone deployment.
#
# Requirements:
#   - Emscripten SDK (https://emscripten.org/)
#   - Swiss Ephemeris source code (lib/sweph/src/)
#   - Ephemeris data files (eph/*.se1)
#
# Main targets:
#   - embedded: Single-file WASM with all data (RECOMMENDED)
#   - development: Multi-file build for debugging
#   - install: Deploy to js/ directory
#   - clean: Remove build artifacts

# Build configuration
CC = emcc
SRCDIR = .
SWEPHDIR = ../sweph/src
EPHDIR = eph
JSDIR = ../../js

# Compiler flags
CFLAGS_BASE = -Wall -fPIC -I$(SWEPHDIR)
CFLAGS_DEBUG = $(CFLAGS_BASE) -O1 -g -DDEBUG
CFLAGS_RELEASE = $(CFLAGS_BASE) -O3 -DNDEBUG

# Libraries
LIBS = -lm -ldl

# WebAssembly configuration
WASM_FLAGS_BASE = -s WASM=1 \
	-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
	-s EXPORTED_FUNCTIONS='["_test", "_get", "_getPlanets", "_getHouses", "_degreesToDMS", "_getJulianDay", "_getPlanet", "_getPlanetaryNodes", "_getSinglePlanetNodes", "_getAsteroids", "_getSpecificAsteroids", "_setEphemerisPath", "_getEphemerisInfo", "_freeMemory", "_malloc", "_free"]'

WASM_FLAGS_EMBEDDED = $(WASM_FLAGS_BASE) \
	-s FORCE_FILESYSTEM=1 \
	-s SINGLE_FILE=1 \
	-s WASM_ASYNC_COMPILATION=0 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s INITIAL_MEMORY=16777216 \
	-s MAXIMUM_MEMORY=134217728 \
	-s STACK_SIZE=1048576 \
	-s NO_EXIT_RUNTIME=1 \
	-s ASSERTIONS=0 \
	-s DISABLE_EXCEPTION_CATCHING=1 \
	-s TEXTDECODER=0 \
	-s ABORTING_MALLOC=0 \
	-s SUPPORT_LONGJMP=0 \
	-s LZ4=1

WASM_FLAGS_DEV = $(WASM_FLAGS_BASE) \
	-s FORCE_FILESYSTEM=1 \
	-s ASSERTIONS=1 \
	-s SAFE_HEAP=1

# File lists
EPHEMERIS_FILES = $(wildcard $(EPHDIR)/*.se1)
EMBED_FLAGS = $(foreach file,$(EPHEMERIS_FILES),--embed-file $(file))

# Default target
.DEFAULT_GOAL := embedded

# Main targets
all: embedded

# Object files
astro.o: astro.c
	@echo "Compiling astro.c (debug)..."
	$(CC) $(CFLAGS_DEBUG) -c $< -o $@

astro-release.o: astro.c
	@echo "Compiling astro.c (release)..."
	$(CC) $(CFLAGS_RELEASE) -c $< -o $@

# Swiss Ephemeris library
libswe.a: $(SWEPHDIR)/*.c $(SWEPHDIR)/*.h
	@echo "Building Swiss Ephemeris library (debug)..."
	$(MAKE) -C $(SWEPHDIR) libswe.a CC="$(CC)" CFLAGS="$(CFLAGS_DEBUG)"
	cp $(SWEPHDIR)/libswe.a .

libswe-release.a: $(SWEPHDIR)/*.c $(SWEPHDIR)/*.h
	@echo "Building Swiss Ephemeris library (release)..."
	$(MAKE) -C $(SWEPHDIR) libswe.a CC="$(CC)" CFLAGS="$(CFLAGS_RELEASE)"
	cp $(SWEPHDIR)/libswe.a $@

# Single-file webapp build (RECOMMENDED)
# Creates one optimized file with embedded ephemeris data and memory-efficient lazy loading
# Swiss Ephemeris handles internal lazy loading of ephemeris files as needed
embedded: astro-embedded.js

astro-embedded.js: astro-release.o libswe-release.a $(EPHEMERIS_FILES)
	@echo "Building single-file webapp-optimized WebAssembly module..."
	@echo "📊 Ephemeris files: $(words $(EPHEMERIS_FILES))"
	@echo "📊 Total ephemeris size: $$(du -sh $(EPHDIR) | cut -f1)"
	@echo "🔨 Embedding data with memory-efficient lazy loading..."
	$(CC) $(CFLAGS_RELEASE) astro-release.o \
		$(EMBED_FLAGS) \
		-o $@ \
		$(WASM_FLAGS_EMBEDDED) \
		-L. -lswe-release $(LIBS)
	@echo "✅ Single-file webapp build complete:"
	@echo "   📁 File: $@ ($$(du -sh $@ | cut -f1))"
	@echo "   🚀 One file deployment with internal lazy loading"
	@echo "   💡 Swiss Ephemeris loads ephemeris data on-demand from virtual filesystem"

# Development build (for testing and debugging)
# Creates separate .js/.wasm/.data files for easier debugging
development: astro-dev.js

astro-dev.js: astro.o libswe.a $(EPHEMERIS_FILES)
	@echo "Building development version with debug symbols..."
	$(CC) $(CFLAGS_DEBUG) astro.o \
		--preload-file $(EPHDIR) \
		-o $@ \
		$(WASM_FLAGS_DEV) \
		-L. -lswe $(LIBS)
	@echo "✅ Development build complete:"
	@echo "   📁 Files: $@ + astro-dev.wasm + astro-dev.data"
	@echo "   🐛 Debug symbols included"

# Install to target directory
install: embedded
	@echo "📦 Installing single-file webapp build to $(JSDIR)/"
	@mkdir -p $(JSDIR)
	cp astro-embedded.js $(JSDIR)/
	@echo "✅ Installed: $(JSDIR)/astro-embedded.js ($$(du -sh $(JSDIR)/astro-embedded.js | cut -f1))"
	@echo "🌐 Ready for web deployment (single file with internal lazy loading)"

# Development install (useful for testing)
install-dev: development
	@echo "📦 Installing development build to $(JSDIR)/"
	@mkdir -p $(JSDIR)
	cp astro-dev.* $(JSDIR)/
	@echo "✅ Installed development files to $(JSDIR)/"

# Verification and info
verify: embedded
	@echo "🔍 Verifying embedded build..."
	@echo "File size: $$(du -sh astro-embedded.js | cut -f1)"
	@echo "Ephemeris files embedded: $(words $(EPHEMERIS_FILES))"
	@if [ -f astro-embedded.js ]; then \
		echo "✅ Build verification passed"; \
	else \
		echo "❌ Build verification failed"; \
		exit 1; \
	fi

info:
	@echo "=== Swiss Ephemeris WebAssembly Build Information ==="
	@echo ""
	@echo "📊 Ephemeris Data:"
	@echo "   Files: $(words $(EPHEMERIS_FILES))"
	@echo "   Location: $(EPHDIR)/"
	@echo "   Total size: $$(du -sh $(EPHDIR) | cut -f1)"
	@echo ""
	@echo "🛠️  Build Configuration:"
	@echo "   Compiler: $(CC)"
	@echo "   Swiss Ephemeris: $(SWEPHDIR)/"
	@echo "   Target directory: $(JSDIR)/"
	@echo ""
	@echo "🎯 Available Targets:"
	@echo "   embedded    - Single-file webapp build (RECOMMENDED)"
	@echo "   development - Multi-file debug build"
	@echo "   install     - Install single-file build to $(JSDIR)/"
	@echo "   install-dev - Install development build to $(JSDIR)/"
	@echo "   verify      - Verify build integrity"
	@echo "   clean       - Remove all build artifacts"
	@echo "   info        - Show this information"
	@echo ""
	@echo "💡 Quick start: make embedded && make install"

# Cleanup
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -f *.o *.a *.js *.wasm *.data *.br *.xz
	rm -rf eph-* temp-*
	@echo "✅ Cleanup complete"

clean-all: clean
	@echo "🧹 Deep cleaning (including Swiss Ephemeris)..."
	$(MAKE) -C $(SWEPHDIR) clean
	@echo "✅ Deep cleanup complete"

# Help target
help: info

# Phony targets
.PHONY: all embedded development install install-dev verify info clean clean-all help

# Dependencies
astro.o: astro.c
astro-release.o: astro.c
astro-embedded.js: astro-release.o libswe-release.a
astro-dev.js: astro.o libswe.a 