"""Create ~/Repositories/nanosim (or the folder given): a dummy codebase test bed for rdstudio's project mode (T64).

A particle simulation with a C++ core bound to Python by nanobind: CMake and scikit-build-core,
tests in both languages, CI workflows, documentation, and rdstudio notes. Commits are backdated
over about three months so the Activity lens has a history to show.

    uv run python bench/nanosim.py [folder]   # replaces the folder if it exists
"""
import os, shutil, subprocess, sys, textwrap
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "Repositories/nanosim")
if ROOT.exists():
    shutil.rmtree(ROOT)
ROOT.mkdir(parents=True)

F = {}
def f(path, text):
    F[path] = textwrap.dedent(text).lstrip("\n")

# ------------------------------------------------------------------ build system
f("CMakeLists.txt", """
cmake_minimum_required(VERSION 3.18)
project(nanosim LANGUAGES CXX VERSION 0.3.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
include(cmake/CompilerWarnings.cmake)

option(NANOSIM_BUILD_TESTS "Build the C++ tests" OFF)
option(NANOSIM_OPENMP "Parallel force loops with OpenMP" ON)

add_library(nanosim_core STATIC
  src/nanosim/core/particle.cpp
  src/nanosim/core/system.cpp
  src/nanosim/forces/gravity.cpp
  src/nanosim/forces/lennard_jones.cpp
  src/nanosim/integrators/verlet.cpp
  src/nanosim/integrators/rk4.cpp
  src/nanosim/neighbors/cell_list.cpp
)
target_include_directories(nanosim_core PUBLIC src)
set_target_properties(nanosim_core PROPERTIES POSITION_INDEPENDENT_CODE ON)
nanosim_set_warnings(nanosim_core)
if(NANOSIM_OPENMP)
  find_package(OpenMP)
  if(OpenMP_CXX_FOUND)
    target_link_libraries(nanosim_core PUBLIC OpenMP::OpenMP_CXX)
  endif()
endif()

if(SKBUILD)
  find_package(Python 3.9 COMPONENTS Interpreter Development.Module REQUIRED)
  find_package(nanobind CONFIG REQUIRED)
  nanobind_add_module(_core
    src/bindings/module.cpp
    src/bindings/bind_core.cpp
    src/bindings/bind_forces.cpp
    src/bindings/bind_integrators.cpp
  )
  target_link_libraries(_core PRIVATE nanosim_core)
  install(TARGETS _core LIBRARY DESTINATION nanosim)
endif()

if(NANOSIM_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests/cpp)
endif()
""")
f("cmake/CompilerWarnings.cmake", """
# Warnings as errors in CI, plain warnings locally.
function(nanosim_set_warnings target)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Wshadow)
  endif()
  if(DEFINED ENV{CI})
    set_target_properties(${target} PROPERTIES COMPILE_WARNING_AS_ERROR ON)
  endif()
endfunction()
""")
f("pyproject.toml", """
[build-system]
requires = ["scikit-build-core>=0.8", "nanobind>=2.0"]
build-backend = "scikit_build_core.build"

[project]
name = "nanosim"
version = "0.3.0"
description = "Particle simulations with a C++ core: gravity, Lennard-Jones, Verlet and RK4."
requires-python = ">=3.9"
dependencies = ["numpy>=1.23"]

[project.optional-dependencies]
test = ["pytest>=7"]
docs = ["mkdocs-material"]

[project.scripts]
nanosim = "nanosim.cli:main"

[tool.scikit-build]
wheel.packages = ["python/nanosim"]
cmake.build-type = "Release"

[tool.pytest.ini_options]
testpaths = ["tests/python"]
""")
f("README.md", """
# nanosim

Particle simulations with a C++ core and a Python front end, bound with
[nanobind](https://github.com/wjakob/nanobind).

```python
import nanosim as ns
sim = ns.Simulation.from_preset("two_body")
sim.run(steps=1000, dt=1e-3)
print(sim.energy())
```

- **Forces:** Newtonian gravity (softened), Lennard-Jones with a cut-off.
- **Integrators:** velocity Verlet (default, symplectic) and classical RK4.
- **Neighbours:** a cell list for short-range forces.
- **Analysis:** energies, the radial distribution function, mean squared displacement.

Build: `pip install -e .` (needs a C++17 compiler and CMake 3.18). Tests:
`pytest` for Python, `cmake -DNANOSIM_BUILD_TESTS=ON` for C++.
See `docs/` for the design and `knowledge/` for decisions and notes.
""")
f(".gitignore", """
build/
dist/
*.egg-info/
__pycache__/
.rdstudio/
_skbuild/
""")
f("rdstudio.toml", """
# rdstudio project configuration
[project]
title = "nanosim"

[paths]
knowledge = "knowledge"
reports = "reports"

[actors]
human = "human:lachlan"
agent = "claude-code/claude-opus-5-5"

# Which files count as which kind of change in the Changes tab.
[changes.categories]
code = ["src/**", "python/**", "tests/**", "CMakeLists.txt", "cmake/**", "pyproject.toml"]
agent = [".github/**"]

# A codebase: project mode, with the learning layer on top.
[teacher]
profile = "codebase"
""")

# ------------------------------------------------------------------ C++ core
f("src/nanosim/core/vec3.hpp", """
#pragma once
#include <cmath>

namespace nanosim {

/// A 3-vector of doubles, small enough to pass by value.
struct Vec3 {
  double x = 0, y = 0, z = 0;

  Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec3 operator*(double s) const { return {x * s, y * s, z * s}; }
  Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }

  double dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  double norm2() const { return dot(*this); }
  double norm() const { return std::sqrt(norm2()); }
};

/// The shortest image of d in a periodic box of side `box` (0 for no box).
inline Vec3 minimum_image(Vec3 d, double box) {
  if (box <= 0) return d;
  d.x -= box * std::round(d.x / box);
  d.y -= box * std::round(d.y / box);
  d.z -= box * std::round(d.z / box);
  return d;
}

}  // namespace nanosim
""")
f("src/nanosim/core/particle.hpp", """
#pragma once
#include "nanosim/core/vec3.hpp"

namespace nanosim {

/// One particle: where it is, how it moves, and the force on it this step.
struct Particle {
  Vec3 position;
  Vec3 velocity;
  Vec3 force;
  double mass = 1.0;
  int species = 0;

  double kinetic_energy() const;
};

}  // namespace nanosim
""")
f("src/nanosim/core/particle.cpp", """
#include "nanosim/core/particle.hpp"

namespace nanosim {

double Particle::kinetic_energy() const { return 0.5 * mass * velocity.norm2(); }

}  // namespace nanosim
""")
f("src/nanosim/core/system.hpp", """
#pragma once
#include <memory>
#include <vector>

#include "nanosim/core/particle.hpp"
#include "nanosim/forces/force.hpp"

namespace nanosim {

/// Default softening length for gravity, in simulation units.
constexpr double DEFAULT_SOFTENING = 1e-3;

/// The particles, the box they live in, and the forces between them.
class ParticleSystem {
 public:
  explicit ParticleSystem(double box = 0.0);

  void add(const Particle& p);
  void add_force(std::shared_ptr<Force> f);

  /// Zero every particle's force, then accumulate each force term.
  void compute_forces();
  double potential_energy() const;
  double kinetic_energy() const;
  double total_energy() const { return potential_energy() + kinetic_energy(); }

  std::vector<Particle>& particles() { return particles_; }
  const std::vector<Particle>& particles() const { return particles_; }
  double box() const { return box_; }
  std::size_t size() const { return particles_.size(); }

 private:
  std::vector<Particle> particles_;
  std::vector<std::shared_ptr<Force>> forces_;
  double box_;
};

}  // namespace nanosim
""")
f("src/nanosim/core/system.cpp", """
#include "nanosim/core/system.hpp"

namespace nanosim {

ParticleSystem::ParticleSystem(double box) : box_(box) {}

void ParticleSystem::add(const Particle& p) { particles_.push_back(p); }

void ParticleSystem::add_force(std::shared_ptr<Force> f) { forces_.push_back(std::move(f)); }

void ParticleSystem::compute_forces() {
  for (auto& p : particles_) p.force = Vec3{};
  for (auto& f : forces_) f->apply(particles_, box_);
}

double ParticleSystem::potential_energy() const {
  double u = 0;
  for (const auto& f : forces_) u += f->energy(particles_, box_);
  return u;
}

double ParticleSystem::kinetic_energy() const {
  double k = 0;
  for (const auto& p : particles_) k += p.kinetic_energy();
  return k;
}

}  // namespace nanosim
""")
f("src/nanosim/forces/force.hpp", """
#pragma once
#include <vector>

#include "nanosim/core/particle.hpp"

namespace nanosim {

/// A force term: adds its contribution to each particle's force, and knows its energy.
class Force {
 public:
  virtual ~Force() = default;
  virtual void apply(std::vector<Particle>& ps, double box) const = 0;
  virtual double energy(const std::vector<Particle>& ps, double box) const = 0;
};

}  // namespace nanosim
""")
f("src/nanosim/forces/gravity.hpp", """
#pragma once
#include "nanosim/forces/force.hpp"

namespace nanosim {

/// Newtonian gravity with Plummer softening: F = G m_i m_j r / (r^2 + eps^2)^(3/2).
class Gravity : public Force {
 public:
  explicit Gravity(double G = 1.0, double softening = 1e-3) : G_(G), eps_(softening) {}
  void apply(std::vector<Particle>& ps, double box) const override;
  double energy(const std::vector<Particle>& ps, double box) const override;

 private:
  double G_, eps_;
};

}  // namespace nanosim
""")
f("src/nanosim/forces/gravity.cpp", """
#include "nanosim/forces/gravity.hpp"

#include <cmath>

namespace nanosim {

void Gravity::apply(std::vector<Particle>& ps, double box) const {
  const std::size_t n = ps.size();
#pragma omp parallel for schedule(dynamic)
  for (std::size_t i = 0; i < n; ++i) {
    for (std::size_t j = 0; j < n; ++j) {
      if (i == j) continue;
      Vec3 d = minimum_image(ps[j].position - ps[i].position, box);
      double r2 = d.norm2() + eps_ * eps_;
      double inv = 1.0 / (r2 * std::sqrt(r2));
      ps[i].force += d * (G_ * ps[i].mass * ps[j].mass * inv);
    }
  }
}

double Gravity::energy(const std::vector<Particle>& ps, double box) const {
  double u = 0;
  for (std::size_t i = 0; i < ps.size(); ++i)
    for (std::size_t j = i + 1; j < ps.size(); ++j) {
      Vec3 d = minimum_image(ps[j].position - ps[i].position, box);
      u -= G_ * ps[i].mass * ps[j].mass / std::sqrt(d.norm2() + eps_ * eps_);
    }
  return u;
}

}  // namespace nanosim
""")
f("src/nanosim/forces/lennard_jones.hpp", """
#pragma once
#include "nanosim/forces/force.hpp"
#include "nanosim/neighbors/cell_list.hpp"

namespace nanosim {

/// The Lennard-Jones 12-6 potential, cut off and shifted at r_cut.
class LennardJones : public Force {
 public:
  LennardJones(double epsilon = 1.0, double sigma = 1.0, double r_cut = 2.5);
  void apply(std::vector<Particle>& ps, double box) const override;
  double energy(const std::vector<Particle>& ps, double box) const override;
  double pair_potential(double r2) const;

 private:
  double eps_, sigma_, rc2_, shift_;
  mutable CellList cells_;
};

}  // namespace nanosim
""")
f("src/nanosim/forces/lennard_jones.cpp", """
#include "nanosim/forces/lennard_jones.hpp"

namespace nanosim {

LennardJones::LennardJones(double epsilon, double sigma, double r_cut)
    : eps_(epsilon), sigma_(sigma), rc2_(r_cut * r_cut), shift_(0), cells_(r_cut) {
  shift_ = -pair_potential(rc2_);
}

double LennardJones::pair_potential(double r2) const {
  double s6 = sigma_ * sigma_ / r2;
  s6 = s6 * s6 * s6;
  return 4 * eps_ * (s6 * s6 - s6);
}

void LennardJones::apply(std::vector<Particle>& ps, double box) const {
  cells_.rebuild(ps, box);
  cells_.for_each_pair([&](std::size_t i, std::size_t j) {
    Vec3 d = minimum_image(ps[j].position - ps[i].position, box);
    double r2 = d.norm2();
    if (r2 >= rc2_) return;
    double s6 = sigma_ * sigma_ / r2;
    s6 = s6 * s6 * s6;
    double f = 24 * eps_ * (2 * s6 * s6 - s6) / r2;
    ps[i].force += d * (-f);
    ps[j].force += d * f;
  });
}

double LennardJones::energy(const std::vector<Particle>& ps, double box) const {
  double u = 0;
  cells_.rebuild(ps, box);
  cells_.for_each_pair([&](std::size_t i, std::size_t j) {
    double r2 = minimum_image(ps[j].position - ps[i].position, box).norm2();
    if (r2 < rc2_) u += pair_potential(r2) + shift_;
  });
  return u;
}

}  // namespace nanosim
""")
f("src/nanosim/neighbors/cell_list.hpp", """
#pragma once
#include <functional>
#include <vector>

#include "nanosim/core/particle.hpp"

namespace nanosim {

/// Bins particles into cells no smaller than the cut-off, so pairs within it
/// are found by looking in a cell and its 26 neighbours: O(N) not O(N^2).
class CellList {
 public:
  explicit CellList(double cutoff) : cutoff_(cutoff) {}
  void rebuild(const std::vector<Particle>& ps, double box);
  void for_each_pair(const std::function<void(std::size_t, std::size_t)>& visit) const;
  int cells_per_side() const { return side_; }

 private:
  double cutoff_;
  int side_ = 1;
  std::vector<std::vector<std::size_t>> cells_;
};

}  // namespace nanosim
""")
f("src/nanosim/neighbors/cell_list.cpp", """
#include "nanosim/neighbors/cell_list.hpp"

#include <algorithm>
#include <cmath>

namespace nanosim {

void CellList::rebuild(const std::vector<Particle>& ps, double box) {
  side_ = box > 0 ? std::max(1, static_cast<int>(std::floor(box / cutoff_))) : 1;
  cells_.assign(static_cast<std::size_t>(side_) * side_ * side_, {});
  auto bin = [&](double v) { return box > 0 ? std::clamp(static_cast<int>(std::floor((v / box + 0.5) * side_)), 0, side_ - 1) : 0; };
  for (std::size_t i = 0; i < ps.size(); ++i) {
    const auto& p = ps[i].position;
    cells_[(bin(p.x) * side_ + bin(p.y)) * side_ + bin(p.z)].push_back(i);
  }
}

void CellList::for_each_pair(const std::function<void(std::size_t, std::size_t)>& visit) const {
  if (side_ < 3) {  // too few cells for neighbours to be distinct: every pair
    std::vector<std::size_t> all;
    for (const auto& c : cells_) all.insert(all.end(), c.begin(), c.end());
    for (std::size_t a = 0; a < all.size(); ++a)
      for (std::size_t b = a + 1; b < all.size(); ++b) visit(all[a], all[b]);
    return;
  }
  auto at = [&](int x, int y, int z) -> const std::vector<std::size_t>& {
    auto w = [&](int v) { return (v + side_) % side_; };
    return cells_[(w(x) * side_ + w(y)) * side_ + w(z)];
  };
  for (int x = 0; x < side_; ++x)
    for (int y = 0; y < side_; ++y)
      for (int z = 0; z < side_; ++z)
        for (int dx = -1; dx <= 1; ++dx)
          for (int dy = -1; dy <= 1; ++dy)
            for (int dz = -1; dz <= 1; ++dz)
              for (auto i : at(x, y, z))
                for (auto j : at(x + dx, y + dy, z + dz))
                  if (i < j) visit(i, j);
}

}  // namespace nanosim
""")
f("src/nanosim/integrators/integrator.hpp", """
#pragma once
#include "nanosim/core/system.hpp"

namespace nanosim {

/// Advances a system by one step of size dt.
class Integrator {
 public:
  virtual ~Integrator() = default;
  virtual void step(ParticleSystem& sys, double dt) = 0;
  virtual const char* name() const = 0;
};

}  // namespace nanosim
""")
f("src/nanosim/integrators/verlet.hpp", """
#pragma once
#include "nanosim/integrators/integrator.hpp"

namespace nanosim {

/// Velocity Verlet: symplectic and time-reversible, second order. The default.
class VelocityVerlet : public Integrator {
 public:
  void step(ParticleSystem& sys, double dt) override;
  const char* name() const override { return "velocity-verlet"; }
};

}  // namespace nanosim
""")
f("src/nanosim/integrators/verlet.cpp", """
#include "nanosim/integrators/verlet.hpp"

namespace nanosim {

void VelocityVerlet::step(ParticleSystem& sys, double dt) {
  auto& ps = sys.particles();
  for (auto& p : ps) {
    p.velocity += p.force * (0.5 * dt / p.mass);
    p.position += p.velocity * dt;
  }
  sys.compute_forces();
  for (auto& p : ps) p.velocity += p.force * (0.5 * dt / p.mass);
}

}  // namespace nanosim
""")
f("src/nanosim/integrators/rk4.hpp", """
#pragma once
#include "nanosim/integrators/integrator.hpp"

namespace nanosim {

/// Classical fourth-order Runge-Kutta. Accurate per step, but not symplectic:
/// energy drifts over long runs (see knowledge/decisions/default-integrator.md).
class RK4 : public Integrator {
 public:
  void step(ParticleSystem& sys, double dt) override;
  const char* name() const override { return "rk4"; }
};

}  // namespace nanosim
""")
f("src/nanosim/integrators/rk4.cpp", """
#include "nanosim/integrators/rk4.hpp"

#include <vector>

namespace nanosim {

void RK4::step(ParticleSystem& sys, double dt) {
  auto& ps = sys.particles();
  const std::size_t n = ps.size();
  std::vector<Vec3> x0(n), v0(n), kx[4], kv[4];
  for (std::size_t i = 0; i < n; ++i) { x0[i] = ps[i].position; v0[i] = ps[i].velocity; }
  const double c[4] = {0, 0.5, 0.5, 1};
  for (int s = 0; s < 4; ++s) {
    kx[s].resize(n); kv[s].resize(n);
    for (std::size_t i = 0; i < n; ++i) {
      if (s) {
        ps[i].position = x0[i] + kx[s - 1][i] * (c[s] * dt);
        ps[i].velocity = v0[i] + kv[s - 1][i] * (c[s] * dt);
      }
    }
    sys.compute_forces();
    for (std::size_t i = 0; i < n; ++i) { kx[s][i] = ps[i].velocity; kv[s][i] = ps[i].force * (1.0 / ps[i].mass); }
  }
  for (std::size_t i = 0; i < n; ++i) {
    ps[i].position = x0[i] + (kx[0][i] + kx[1][i] * 2 + kx[2][i] * 2 + kx[3][i]) * (dt / 6);
    ps[i].velocity = v0[i] + (kv[0][i] + kv[1][i] * 2 + kv[2][i] * 2 + kv[3][i]) * (dt / 6);
  }
}

}  // namespace nanosim
""")

# ------------------------------------------------------------------ bindings
f("src/bindings/module.cpp", """
#include <nanobind/nanobind.h>

namespace nb = nanobind;

void bind_core(nb::module_& m);
void bind_forces(nb::module_& m);
void bind_integrators(nb::module_& m);

NB_MODULE(_core, m) {
  m.doc() = "nanosim's C++ core";
  bind_core(m);
  bind_forces(m);
  bind_integrators(m);
}
""")
f("src/bindings/bind_core.cpp", """
#include <nanobind/nanobind.h>
#include <nanobind/ndarray.h>
#include <nanobind/stl/vector.h>

#include "nanosim/core/system.hpp"

namespace nb = nanobind;
using namespace nanosim;

void bind_core(nb::module_& m) {
  nb::class_<Vec3>(m, "Vec3")
      .def(nb::init<>())
      .def_rw("x", &Vec3::x).def_rw("y", &Vec3::y).def_rw("z", &Vec3::z)
      .def("norm", &Vec3::norm);

  nb::class_<Particle>(m, "Particle")
      .def(nb::init<>())
      .def_rw("position", &Particle::position)
      .def_rw("velocity", &Particle::velocity)
      .def_rw("mass", &Particle::mass)
      .def("kinetic_energy", &Particle::kinetic_energy);

  nb::class_<ParticleSystem>(m, "ParticleSystem")
      .def(nb::init<double>(), nb::arg("box") = 0.0)
      .def("add", &ParticleSystem::add)
      .def("add_force", &ParticleSystem::add_force)
      .def("compute_forces", &ParticleSystem::compute_forces)
      .def("potential_energy", &ParticleSystem::potential_energy)
      .def("kinetic_energy", &ParticleSystem::kinetic_energy)
      .def("total_energy", &ParticleSystem::total_energy)
      .def("__len__", &ParticleSystem::size)
      .def("positions", [](ParticleSystem& s) {
        // A zero-copy (N, 3) view of the positions, valid while the system lives.
        auto& ps = s.particles();
        return nb::ndarray<nb::numpy, double, nb::shape<-1, 3>>(
            &ps.data()->position.x, {ps.size(), 3}, nb::handle(), {static_cast<int64_t>(sizeof(Particle) / sizeof(double)), 1});
      }, nb::rv_policy::reference_internal);

  m.attr("DEFAULT_SOFTENING") = DEFAULT_SOFTENING;
}
""")
f("src/bindings/bind_forces.cpp", """
#include <nanobind/nanobind.h>
#include <nanobind/stl/shared_ptr.h>

#include "nanosim/forces/gravity.hpp"
#include "nanosim/forces/lennard_jones.hpp"

namespace nb = nanobind;
using namespace nanosim;

void bind_forces(nb::module_& m) {
  nb::class_<Force>(m, "Force");
  nb::class_<Gravity, Force>(m, "Gravity")
      .def(nb::init<double, double>(), nb::arg("G") = 1.0, nb::arg("softening") = 1e-3);
  nb::class_<LennardJones, Force>(m, "LennardJones")
      .def(nb::init<double, double, double>(), nb::arg("epsilon") = 1.0, nb::arg("sigma") = 1.0, nb::arg("r_cut") = 2.5)
      .def("pair_potential", &LennardJones::pair_potential);
}
""")
f("src/bindings/bind_integrators.cpp", """
#include <nanobind/nanobind.h>

#include "nanosim/integrators/rk4.hpp"
#include "nanosim/integrators/verlet.hpp"

namespace nb = nanobind;
using namespace nanosim;

void bind_integrators(nb::module_& m) {
  nb::class_<Integrator>(m, "Integrator")
      .def("step", &Integrator::step, nb::call_guard<nb::gil_scoped_release>())
      .def_prop_ro("name", &Integrator::name);
  nb::class_<VelocityVerlet, Integrator>(m, "VelocityVerlet").def(nb::init<>());
  nb::class_<RK4, Integrator>(m, "RK4").def(nb::init<>());
}
""")

# ------------------------------------------------------------------ Python package
f("python/nanosim/__init__.py", '''
"""nanosim: particle simulations with a C++ core."""
from ._core import (DEFAULT_SOFTENING, RK4, Gravity, LennardJones, Particle,
                    ParticleSystem, Vec3, VelocityVerlet)
from .simulation import Simulation
from . import analysis, io, presets

__all__ = ["Simulation", "ParticleSystem", "Particle", "Vec3", "Gravity", "LennardJones",
           "VelocityVerlet", "RK4", "DEFAULT_SOFTENING", "analysis", "io", "presets"]
__version__ = "0.3.0"
''')
f("python/nanosim/simulation.py", '''
"""The Python front end: a system, an integrator and a record of what happened."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import _core

#: Integrators by name, for configuration files and the command line.
INTEGRATORS = {"velocity-verlet": _core.VelocityVerlet, "rk4": _core.RK4}


@dataclass
class Trajectory:
    """Positions and energies sampled every `stride` steps."""
    stride: int
    positions: list = field(default_factory=list)
    energies: list = field(default_factory=list)

    def as_array(self) -> np.ndarray:
        return np.stack(self.positions)


class Simulation:
    """A particle system advanced by an integrator, sampled into a trajectory."""

    def __init__(self, system: _core.ParticleSystem, integrator: str = "velocity-verlet"):
        self.system = system
        self.integrator = INTEGRATORS[integrator]()
        self.time = 0.0
        self.trajectory = Trajectory(stride=10)
        self.system.compute_forces()

    @classmethod
    def from_preset(cls, name: str, **kwargs) -> "Simulation":
        from .presets import PRESETS
        system = PRESETS[name](**kwargs)
        return cls(system)

    def run(self, steps: int, dt: float) -> None:
        """Advance `steps` steps of size `dt`, sampling every `trajectory.stride`."""
        for k in range(steps):
            self.integrator.step(self.system, dt)
            self.time += dt
            if k % self.trajectory.stride == 0:
                self.trajectory.positions.append(np.array(self.system.positions(), copy=True))
                self.trajectory.energies.append(self.energy())

    def energy(self) -> float:
        return self.system.total_energy()

    def energy_drift(self) -> float:
        """Relative change in total energy since the first sample."""
        e = np.asarray(self.trajectory.energies)
        return float(abs(e[-1] - e[0]) / abs(e[0])) if len(e) > 1 else 0.0
''')
f("python/nanosim/analysis.py", '''
"""Measurements on trajectories: energy, the radial distribution function, diffusion."""
from __future__ import annotations

import numpy as np

#: Bins for the radial distribution function unless asked otherwise.
RDF_BINS = 100


def kinetic_temperature(velocities: np.ndarray, masses: np.ndarray) -> float:
    """Temperature from equipartition, in units where k_B = 1."""
    ke = 0.5 * np.sum(masses[:, None] * velocities**2)
    return 2 * ke / (3 * len(masses))


def radial_distribution(positions: np.ndarray, box: float, r_max: float, bins: int = RDF_BINS):
    """g(r) for one frame of a periodic box: pair counts over the ideal-gas counts."""
    n = len(positions)
    d = positions[:, None, :] - positions[None, :, :]
    d -= box * np.round(d / box)
    r = np.sqrt((d**2).sum(-1))[np.triu_indices(n, 1)]
    hist, edges = np.histogram(r, bins=bins, range=(0, r_max))
    shell = 4 / 3 * np.pi * (edges[1:] ** 3 - edges[:-1] ** 3)
    ideal = shell * n * (n - 1) / 2 / box**3
    return 0.5 * (edges[1:] + edges[:-1]), hist / ideal


def mean_squared_displacement(traj: np.ndarray) -> np.ndarray:
    """MSD against lag, averaged over particles and time origins (unwrapped positions)."""
    lags = np.arange(1, len(traj))
    return np.array([np.mean(np.sum((traj[l:] - traj[:-l]) ** 2, axis=-1)) for l in lags])


def diffusion_coefficient(msd: np.ndarray, dt: float) -> float:
    """D from the slope of the MSD's second half: MSD = 6 D t in three dimensions."""
    t = np.arange(1, len(msd) + 1) * dt
    half = len(msd) // 2
    slope = np.polyfit(t[half:], msd[half:], 1)[0]
    return slope / 6
''')
f("python/nanosim/io.py", '''
"""Saving and loading trajectories (NumPy .npz, with the settings beside them)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def save_trajectory(path: str | Path, positions: np.ndarray, energies, settings: dict) -> None:
    np.savez_compressed(path, positions=positions, energies=np.asarray(energies), settings=json.dumps(settings))


def load_trajectory(path: str | Path):
    data = np.load(path)
    return data["positions"], data["energies"], json.loads(str(data["settings"]))


def write_xyz(path: str | Path, positions: np.ndarray, species: str = "Ar") -> None:
    """One frame per block, for viewers such as OVITO or VMD."""
    with open(path, "w") as out:
        for frame in positions:
            out.write(f"{len(frame)}\\n\\n")
            for x, y, z in frame:
                out.write(f"{species} {x:.6f} {y:.6f} {z:.6f}\\n")
''')
f("python/nanosim/presets.py", '''
"""Ready-made systems for examples and tests."""
from __future__ import annotations

import numpy as np

from . import _core


def two_body(mass_ratio: float = 1.0) -> _core.ParticleSystem:
    """Two bodies on a circular orbit about their centre of mass (G = 1)."""
    sys = _core.ParticleSystem()
    m1, m2 = 1.0, mass_ratio
    r = 1.0
    v = np.sqrt((m1 + m2) / r)
    for m, x, vy in [(m1, -m2 / (m1 + m2), -v * m2 / (m1 + m2)), (m2, m1 / (m1 + m2), v * m1 / (m1 + m2))]:
        p = _core.Particle()
        p.mass = m
        p.position = _vec(x, 0, 0)
        p.velocity = _vec(0, vy, 0)
        sys.add(p)
    sys.add_force(_core.Gravity(1.0, 0.0))
    return sys


def lennard_jones_gas(n_side: int = 6, density: float = 0.8, temperature: float = 1.0, seed: int = 0) -> _core.ParticleSystem:
    """A cubic lattice of n_side^3 Lennard-Jones particles with Maxwell-Boltzmann velocities."""
    rng = np.random.default_rng(seed)
    n = n_side**3
    box = (n / density) ** (1 / 3)
    sys = _core.ParticleSystem(box)
    grid = (np.indices((n_side,) * 3).reshape(3, -1).T + 0.5) * box / n_side - box / 2
    v = rng.normal(0, np.sqrt(temperature), (n, 3))
    v -= v.mean(axis=0)
    for x, vel in zip(grid, v):
        p = _core.Particle()
        p.position = _vec(*x)
        p.velocity = _vec(*vel)
        sys.add(p)
    sys.add_force(_core.LennardJones())
    return sys


def _vec(x, y, z) -> _core.Vec3:
    v = _core.Vec3()
    v.x, v.y, v.z = float(x), float(y), float(z)
    return v


PRESETS = {"two_body": two_body, "lennard_jones_gas": lennard_jones_gas}
''')
f("python/nanosim/cli.py", '''
"""nanosim on the command line: run a preset and save its trajectory."""
from __future__ import annotations

import argparse

from .io import save_trajectory
from .presets import PRESETS
from .simulation import INTEGRATORS, Simulation


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="nanosim")
    ap.add_argument("preset", choices=sorted(PRESETS))
    ap.add_argument("--steps", type=int, default=1000)
    ap.add_argument("--dt", type=float, default=1e-3)
    ap.add_argument("--integrator", choices=sorted(INTEGRATORS), default="velocity-verlet")
    ap.add_argument("--out", default="trajectory.npz")
    args = ap.parse_args(argv)
    sim = Simulation(PRESETS[args.preset](), integrator=args.integrator)
    sim.run(args.steps, args.dt)
    save_trajectory(args.out, sim.trajectory.as_array(), sim.trajectory.energies, vars(args))
    print(f"{args.steps} steps, energy drift {sim.energy_drift():.2e}, saved to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
''')

# ------------------------------------------------------------------ tests
f("tests/python/test_simulation.py", '''
import nanosim as ns


def test_two_body_conserves_energy_with_verlet():
    sim = ns.Simulation.from_preset("two_body")
    sim.run(steps=2000, dt=1e-3)
    assert sim.energy_drift() < 1e-5


def test_rk4_drifts_more_than_verlet_over_long_runs():
    a = ns.Simulation.from_preset("two_body")
    b = ns.Simulation(ns.presets.two_body(), integrator="rk4")
    for s in (a, b):
        s.run(steps=20000, dt=5e-3)
    assert b.energy_drift() > a.energy_drift()
''')
f("tests/python/test_analysis.py", '''
import numpy as np

from nanosim import analysis


def test_rdf_of_an_ideal_gas_is_flat():
    rng = np.random.default_rng(1)
    box = 10.0
    pos = rng.uniform(-box / 2, box / 2, (800, 3))
    r, g = analysis.radial_distribution(pos, box, r_max=4.0, bins=20)
    assert abs(g[5:].mean() - 1) < 0.1


def test_diffusion_of_a_random_walk():
    rng = np.random.default_rng(2)
    steps = rng.normal(0, 1, (2000, 50, 3))
    traj = np.cumsum(steps, axis=0)
    msd = analysis.mean_squared_displacement(traj[::10])
    assert 0.4 < analysis.diffusion_coefficient(msd, dt=10) < 0.6
''')
f("tests/python/test_io.py", '''
import numpy as np

from nanosim import io


def test_round_trip(tmp_path):
    pos = np.zeros((3, 2, 3))
    io.save_trajectory(tmp_path / "t.npz", pos, [1.0, 1.0, 1.0], {"dt": 0.01})
    p, e, s = io.load_trajectory(tmp_path / "t.npz")
    assert p.shape == (3, 2, 3) and s["dt"] == 0.01
''')
f("tests/cpp/CMakeLists.txt", """
include(FetchContent)
FetchContent_Declare(Catch2 GIT_REPOSITORY https://github.com/catchorg/Catch2.git GIT_TAG v3.5.2)
FetchContent_MakeAvailable(Catch2)
add_executable(nanosim_tests test_vec3.cpp test_verlet.cpp test_cell_list.cpp)
target_link_libraries(nanosim_tests PRIVATE nanosim_core Catch2::Catch2WithMain)
add_test(NAME nanosim_tests COMMAND nanosim_tests)
""")
f("tests/cpp/test_vec3.cpp", """
#include <catch2/catch_test_macros.hpp>

#include "nanosim/core/vec3.hpp"

using nanosim::Vec3;

TEST_CASE("minimum image wraps into the box") {
  Vec3 d{0.9, -0.9, 0.2};
  Vec3 w = nanosim::minimum_image(d, 1.0);
  REQUIRE(w.x < 0);
  REQUIRE(w.y > 0);
}
""")
f("tests/cpp/test_verlet.cpp", """
#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>
#include <memory>

#include "nanosim/core/system.hpp"
#include "nanosim/forces/gravity.hpp"
#include "nanosim/integrators/verlet.hpp"

using namespace nanosim;

TEST_CASE("velocity Verlet keeps a circular orbit's energy") {
  ParticleSystem sys;
  sys.add({{-0.5, 0, 0}, {0, -0.7071, 0}, {}, 1.0});
  sys.add({{0.5, 0, 0}, {0, 0.7071, 0}, {}, 1.0});
  sys.add_force(std::make_shared<Gravity>(1.0, 0.0));
  sys.compute_forces();
  const double e0 = sys.total_energy();
  VelocityVerlet vv;
  for (int i = 0; i < 1000; ++i) vv.step(sys, 1e-3);
  REQUIRE(sys.total_energy() == Catch::Approx(e0).epsilon(1e-6));
}
""")
f("tests/cpp/test_cell_list.cpp", """
#include <catch2/catch_test_macros.hpp>

#include "nanosim/neighbors/cell_list.hpp"

using namespace nanosim;

TEST_CASE("every close pair is visited once") {
  std::vector<Particle> ps(4);
  ps[1].position = {0.5, 0, 0};
  CellList cells(1.0);
  cells.rebuild(ps, 10.0);
  int pairs = 0;
  cells.for_each_pair([&](std::size_t, std::size_t) { ++pairs; });
  REQUIRE(pairs >= 1);
}
""")

# ------------------------------------------------------------------ CI and docs
f(".github/workflows/ci.yml", """
name: CI
on: [push, pull_request]
jobs:
  python:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        python: ["3.9", "3.12"]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "${{ matrix.python }}" }
      - run: pip install .[test]
      - run: pytest -q
  cpp:
    runs-on: ubuntu-latest
    env: { CI: "1" }
    steps:
      - uses: actions/checkout@v4
      - run: cmake -B build -DNANOSIM_BUILD_TESTS=ON -DNANOSIM_OPENMP=OFF
      - run: cmake --build build -j
      - run: ctest --test-dir build --output-on-failure
""")
f(".github/workflows/wheels.yml", """
name: Wheels
on:
  push:
    tags: ["v*"]
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-14, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pypa/cibuildwheel@v2.19
        env:
          CIBW_SKIP: "pp* *-musllinux*"
          CIBW_TEST_REQUIRES: pytest
          CIBW_TEST_COMMAND: pytest {project}/tests/python -q
      - uses: actions/upload-artifact@v4
        with: { name: "wheels-${{ matrix.os }}", path: wheelhouse/*.whl }
""")
f(".github/workflows/docs.yml", """
name: Docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install .[docs]
      - run: mkdocs gh-deploy --force
""")
f("mkdocs.yml", """
site_name: nanosim
nav:
  - Home: index.md
  - Architecture: architecture.md
  - Forces: forces.md
  - Integrators: integrators.md
  - Python API: api.md
theme: { name: material }
""")
f("docs/index.md", """
# nanosim

Particle simulations with a C++ core and a Python front end. Start with
`Simulation.from_preset("two_body")`, then read [Architecture](architecture.md).
""")
f("docs/architecture.md", """
# Architecture

Three layers:

1. **C++ core** (`src/nanosim/`): `ParticleSystem` owns the particles and a
   list of `Force` terms; an `Integrator` advances it. No Python here.
2. **Bindings** (`src/bindings/`): nanobind exposes the core as the
   `nanosim._core` extension. Positions come back as a zero-copy NumPy view.
3. **Python** (`python/nanosim/`): `Simulation` wraps a system and an
   integrator and samples a trajectory; `analysis` measures it.

The hot loops (force evaluation, integration) never call back into Python,
and `Integrator.step` releases the GIL.
""")
f("docs/forces.md", """
# Forces

- **Gravity**: all pairs, O(N²), with Plummer softening ε (default 1e-3) so
  close encounters do not blow up.
- **Lennard-Jones**: 12-6, cut and shifted at r_c = 2.5σ, pairs found with a
  cell list, O(N).
""")
f("docs/integrators.md", """
# Integrators

- **Velocity Verlet** (default): second order, symplectic, time-reversible.
  Energy oscillates but does not drift.
- **RK4**: fourth order per step, not symplectic: energy drifts on long runs.
  Useful for short, accurate trajectories.
""")
f("docs/api.md", """
# Python API

- `Simulation(system, integrator="velocity-verlet")`, `.run(steps, dt)`, `.energy()`, `.energy_drift()`
- `analysis.radial_distribution`, `analysis.mean_squared_displacement`, `analysis.diffusion_coefficient`
- `io.save_trajectory`, `io.load_trajectory`, `io.write_xyz`
""")
f("examples/two_body.py", '''
"""A circular two-body orbit: energy drift for Verlet and RK4."""
import nanosim as ns

for integrator in ("velocity-verlet", "rk4"):
    sim = ns.Simulation(ns.presets.two_body(), integrator=integrator)
    sim.run(steps=10000, dt=5e-3)
    print(f"{integrator:16s} drift {sim.energy_drift():.2e}")
''')
f("examples/lennard_jones_gas.py", '''
"""A Lennard-Jones gas: equilibrate, then measure g(r) and the diffusion coefficient."""
import numpy as np

import nanosim as ns
from nanosim import analysis

sim = ns.Simulation(ns.presets.lennard_jones_gas(n_side=6, density=0.8))
sim.run(steps=2000, dt=2e-3)
traj = sim.trajectory.as_array()
r, g = analysis.radial_distribution(traj[-1], sim.system.box(), r_max=3.0)
print("first peak of g(r) at r =", r[np.argmax(g)])
''')

# ------------------------------------------------------------------ rdstudio notes
G = "generated:\n  by: claude-code/claude-opus-5-5\n  at: 2026-10-05T12:00:00Z"
# Which code each note is about (code: in its frontmatter, T66): an item's id, a file, or a name.
CODE = {
    "design/particle-system.md": ["src/nanosim/core/system.hpp#nanosim::ParticleSystem"],
    "design/cell-lists.md": ["CellList"],
    "design/zero-copy-views.md": ["src/bindings/bind_core.cpp#bind_core"],
    "design/integrators.md": ["Integrator", "RK4"],
    "design/forces.md": ["Force", "Gravity", "LennardJones"],
    "decisions/default-integrator.md": ["VelocityVerlet", "python/nanosim/simulation.py#INTEGRATORS"],
    "decisions/why-nanobind.md": ["src/bindings/module.cpp"],
    "concepts/minimum-image.md": ["minimum_image"],
}
def note(path, typ, title, desc, body, extra=""):
    code = f"code: [{', '.join(repr(c).replace(chr(39), chr(34)) for c in CODE[path])}]\n" if path in CODE else ""
    f(f"knowledge/{path}", f"---\ntype: {typ}\ntitle: {title}\ndescription: {desc}\n{extra}{code}{G}\n---\n\n{textwrap.dedent(body).strip()}\n")

note("overview.md", "Overview", "nanosim", "Particle simulations with a C++ core bound to Python by nanobind.", """
# What this is

nanosim simulates particles under gravity or the Lennard-Jones potential. The
[architecture](/design/architecture.md "requires") has three layers: a C++
core, nanobind bindings, and a Python front end.

# Where to start

- [Architecture](/design/architecture.md)
- [Why nanobind](/decisions/why-nanobind.md)
- [Velocity Verlet by default](/decisions/default-integrator.md)
- [Onboarding](/guides/onboarding.md)
""", "landmark: true\n")
note("design/architecture.md", "Design", "Architecture", "The three layers (C++ core, bindings, Python) and why the hot loops stay in C++.", """
# Layers

1. **The core** ([particle system](/design/particle-system.md "requires"),
   [forces](/design/forces.md "requires"), [integrators](/design/integrators.md "requires")).
2. **The bindings**: [nanobind](/decisions/why-nanobind.md "uses"), with a
   [zero-copy positions view](/design/zero-copy-views.md "uses").
3. **Python**: `Simulation`, `analysis`, `io`, `presets`.

The GIL is released in `Integrator.step`, so a Python thread can watch a run.
""", "landmark: true\n")
note("design/particle-system.md", "Design", "The particle system", "ParticleSystem owns particles and force terms; forces accumulate; energies are summed per term.", """
`ParticleSystem` holds an array of `Particle` (position, velocity, force,
mass, species) and a list of `Force` terms. `compute_forces` zeroes forces
then lets each term add its share. A periodic box (side `box`, 0 for none)
is handled by the [minimum image convention](/concepts/minimum-image.md "requires").
""")
note("design/forces.md", "Design", "Forces", "Gravity over all pairs with softening; Lennard-Jones with a cut-off and a cell list.", """
- **Gravity**: O(N²), [softened](/concepts/softening.md "requires").
- **Lennard-Jones**: cut and shifted at 2.5σ, pairs from a
  [cell list](/design/cell-lists.md "requires").
""")
note("design/cell-lists.md", "Design", "Cell lists", "Binning particles into cells no smaller than the cut-off makes short-range forces O(N).", """
Cells of side ≥ r_c; each particle interacts with its own cell and the 26
around it. With fewer than three cells a side, every pair is visited (the
neighbours would repeat). Uses the [minimum image](/concepts/minimum-image.md "requires").
""")
note("design/integrators.md", "Design", "Integrators", "Velocity Verlet (default) and RK4 behind one interface.", """
Both implement `Integrator::step(system, dt)`. See
[why Verlet is the default](/decisions/default-integrator.md "requires") and
[symplectic integrators](/concepts/symplectic-integrators.md "requires").
""")
note("design/zero-copy-views.md", "Design", "Zero-copy views", "positions() returns a NumPy view into the C++ array, strided over Particle, valid while the system lives.", """
`ParticleSystem.positions()` returns an `(N, 3)` view with a stride of
`sizeof(Particle)/sizeof(double)` doubles. It is `reference_internal`, so
the system outlives the view. Copy it to keep a frame: `Simulation.run` does.
""")
note("decisions/why-nanobind.md", "Decision", "Why nanobind", "Smaller, faster bindings than pybind11, with first-class NumPy arrays; at the cost of C++17 and Python 3.8+.", """
# Decision

Bind with nanobind, not pybind11 or Cython.

# Why

- Binaries about 3 to 5 times smaller, and faster to compile.
- `nb::ndarray` gives zero-copy NumPy views without extra dependencies.
- scikit-build-core and nanobind's CMake helpers make wheels simple.

# Cost

C++17 and Python ≥ 3.8; fewer Stack Overflow answers than pybind11.
""", "status: accepted\n")
note("decisions/default-integrator.md", "Decision", "Velocity Verlet by default", "Symplectic integration keeps long runs' energy bounded; RK4 stays available for short accurate trajectories.", """
# Decision

`Simulation` uses velocity Verlet unless asked otherwise.

# Why

RK4 is more accurate per step but drifts in energy over long runs, which
ruins equilibrium statistics. Verlet is [symplectic](/concepts/symplectic-integrators.md "requires"):
its energy error stays bounded. `tests/python/test_simulation.py` checks both.
""", "status: accepted\n")
note("decisions/units.md", "Decision", "Reduced units", "Lennard-Jones runs use reduced units (σ = ε = m = k_B = 1); gravity uses G = 1.", """
All quantities are in reduced units. Convert at the edges (`io`), never in
the core.
""", "status: accepted\n")
note("concepts/minimum-image.md", "Definition", "Minimum image convention", "In a periodic box, measure each separation to the nearest periodic copy.", """
For a box of side L, replace each component d of a separation by
d − L·round(d/L). Valid while the cut-off is below L/2.
""")
note("concepts/softening.md", "Definition", "Gravitational softening", "Plummer softening replaces 1/r² by r/(r² + ε²)^(3/2) so close encounters stay finite.", """
With softening ε the force between two masses is
G m₁ m₂ r / (r² + ε²)^{3/2}. It biases forces below ε and bounds the
step-size needed for close passes.
""")
note("concepts/symplectic-integrators.md", "Definition", "Symplectic integrators", "Integrators that preserve phase-space volume, so a nearby Hamiltonian is conserved and energy errors stay bounded.", """
A symplectic integrator's map preserves the symplectic form. It exactly
conserves a "shadow" Hamiltonian close to the true one, so energy oscillates
without drifting. Velocity Verlet is one; RK4 is not.
""")
note("guides/onboarding.md", "Procedure", "Onboarding", "Build, test and find your way around nanosim in an afternoon.", """
1. `pip install -e .[test]` and run `pytest`.
2. Read the [architecture](/design/architecture.md "requires").
3. Run `examples/two_body.py` and compare the integrators' drift.
4. Read [why nanobind](/decisions/why-nanobind.md) before touching `src/bindings/`.
""")
note("tasks/barnes-hut.md", "Task", "Barnes-Hut gravity", "Replace all-pairs gravity with an O(N log N) octree for large N.", """
Gravity is O(N²) (see [forces](/design/forces.md "requires")). An octree with
an opening angle θ ≈ 0.5 would make 10⁵ bodies practical.
""", "status: open\n")
note("tasks/thermostat.md", "Task", "A Langevin thermostat", "Sample the canonical ensemble by adding friction and noise to the integrator.", """
Needs a new [integrator](/design/integrators.md "requires") (BAOAB splitting).
""", "status: open\n")

for path, text in F.items():
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)

# ------------------------------------------------------------------ history
def git(*args, date=None):
    env = {**os.environ, "GIT_AUTHOR_NAME": "Lachlan Stewart", "GIT_AUTHOR_EMAIL": "dev@example.com",
           "GIT_COMMITTER_NAME": "Lachlan Stewart", "GIT_COMMITTER_EMAIL": "dev@example.com"}
    if date:
        env["GIT_AUTHOR_DATE"] = env["GIT_COMMITTER_DATE"] = date
    subprocess.run(["git", *args], cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)

now = datetime.now(timezone.utc)
STEPS = [
    (100, "Core: Vec3, Particle and ParticleSystem; CMake", ["CMakeLists.txt", "cmake/", "src/nanosim/core/", "README.md", ".gitignore"]),
    (96, "Forces: the Force interface and softened gravity", ["src/nanosim/forces/force.hpp", "src/nanosim/forces/gravity.hpp", "src/nanosim/forces/gravity.cpp"]),
    (92, "Integrators: velocity Verlet", ["src/nanosim/integrators/integrator.hpp", "src/nanosim/integrators/verlet.hpp", "src/nanosim/integrators/verlet.cpp"]),
    (85, "Bindings with nanobind; Python package and presets", ["src/bindings/", "python/nanosim/__init__.py", "python/nanosim/simulation.py", "python/nanosim/presets.py", "pyproject.toml"]),
    (80, "Decisions: nanobind, units", ["knowledge/decisions/why-nanobind.md", "knowledge/decisions/units.md", "knowledge/overview.md", "rdstudio.toml"]),
    (70, "Tests and CI", ["tests/", ".github/workflows/ci.yml"]),
    (62, "RK4, and the decision to keep Verlet as the default", ["src/nanosim/integrators/rk4.hpp", "src/nanosim/integrators/rk4.cpp", "knowledge/decisions/default-integrator.md", "knowledge/concepts/symplectic-integrators.md"]),
    (45, "Lennard-Jones with a cell list", ["src/nanosim/neighbors/", "src/nanosim/forces/lennard_jones.hpp", "src/nanosim/forces/lennard_jones.cpp", "knowledge/design/cell-lists.md", "knowledge/concepts/minimum-image.md"]),
    (38, "Docs site and design notes", ["docs/", "mkdocs.yml", ".github/workflows/docs.yml", "knowledge/design/", "knowledge/concepts/softening.md"]),
    (24, "Analysis: g(r), MSD and diffusion; trajectories to disk", ["python/nanosim/analysis.py", "python/nanosim/io.py", "examples/"]),
    (16, "Wheels for three platforms", [".github/workflows/wheels.yml"]),
    (9, "Command line; onboarding guide", ["python/nanosim/cli.py", "knowledge/guides/"]),
    (4, "Zero-copy positions view; release the GIL while stepping", ["src/bindings/bind_core.cpp", "src/bindings/bind_integrators.cpp", "knowledge/design/zero-copy-views.md"]),
    (1, "Tasks: Barnes-Hut, thermostat", ["knowledge/tasks/"]),
]
git("init", "-q", "-b", "main")
for days, msg, paths in STEPS:
    when = (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S%z")
    git("add", *paths)
    git("commit", "-q", "--allow-empty", "-m", msg, date=when)
git("add", "-A")
git("commit", "-q", "--allow-empty", "-m", "Everything else", date=now.strftime("%Y-%m-%dT%H:%M:%S%z"))
print(ROOT, len(F), "files")
