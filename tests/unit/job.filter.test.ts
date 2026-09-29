import { describe, expect, it } from "vitest";
import type { InferSelectModel } from "drizzle-orm";
import { jobOffers } from "../../src/database/schema/job-offers.js";
import {
  filterJobOffer,
  type JobFilterResult,
} from "../../src/modules/jobs/job.filter.js";

type JobOffer = InferSelectModel<typeof jobOffers>;

function crearOferta(
  overrides: Partial<JobOffer> = {},
): JobOffer {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    source: "test",
    sourceJobId: null,
    normalizedUrl: "https://example.com/job/1",
    title: "Desarrollador Web",
    company: "Empresa de prueba",
    jobFamily: "WEB",
    role: "WEB_DEVELOPER",
    country: "Spain",
    city: "Castellón de la Plana",
    modality: "ONSITE",
    distanceKm: null,
    contract: "PERMANENT",
    employmentType: "EMPLOYEE",
    workingHours: "FULL_TIME",
    ...overrides,
  };
}

describe("filterJobOffer", () => {
  it("acepta una oferta permanente para empleado", () => {
    const resultado = filterJobOffer(crearOferta());

    expect(resultado).toEqual<JobFilterResult>({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("rechaza las prácticas", () => {
    const resultado = filterJobOffer(
      crearOferta({
        employmentType: "INTERNSHIP",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["INTERNSHIP"],
    });
  });

  it("rechaza las becas", () => {
    const resultado = filterJobOffer(
      crearOferta({
        employmentType: "SCHOLARSHIP",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["SCHOLARSHIP"],
    });
  });

  it("rechaza las posiciones trainee", () => {
    const resultado = filterJobOffer(
      crearOferta({
        employmentType: "TRAINEE",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["TRAINEE"],
    });
  });

  it("rechaza los contratos temporales", () => {
    const resultado = filterJobOffer(
      crearOferta({
        contract: "TEMPORARY",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["TEMPORARY_CONTRACT"],
    });
  });

  it("rechaza las familias de puesto irrelevantes", () => {
    const resultado = filterJobOffer(
      crearOferta({
        jobFamily: "OTHER",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["IRRELEVANT_JOB_FAMILY"],
    });
  });

  it("rechaza los puestos de técnico de hardware", () => {
    const resultado = filterJobOffer(
      crearOferta({
        role: "HARDWARE_TECHNICIAN",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["HARDWARE_SUPPORT"],
    });
  });

  it("rechaza las ofertas presenciales en otra provincia conocida", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Alicante",
        modality: "ONSITE",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: ["ONSITE_TOO_FAR"],
    });
  });

  it("acepta las ofertas presenciales en Castellón", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Vila-real",
        modality: "ONSITE",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("acepta las ofertas presenciales en Valencia", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Valencia",
        modality: "ONSITE",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("no rechaza una oferta presencial con ciudad desconocida", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Ciudad Inventada",
        modality: "ONSITE",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("no aplica el filtro de ubicación a ofertas remotas", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Madrid",
        modality: "REMOTE",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("no aplica el filtro de ubicación a ofertas híbridas", () => {
    const resultado = filterJobOffer(
      crearOferta({
        city: "Madrid",
        modality: "HYBRID",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("permite el trabajo freelance", () => {
    const resultado = filterJobOffer(
      crearOferta({
        employmentType: "FREELANCE",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("permite el trabajo por cuenta propia", () => {
    const resultado = filterJobOffer(
      crearOferta({
        employmentType: "SELF_EMPLOYED",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("no rechaza valores desconocidos por sí mismos", () => {
    const resultado = filterJobOffer(
      crearOferta({
        jobFamily: "UNKNOWN",
        role: "UNKNOWN",
        city: null,
        modality: "UNKNOWN",
        contract: "UNKNOWN",
        employmentType: "UNKNOWN",
        workingHours: "UNKNOWN",
      }),
    );

    expect(resultado).toEqual({
      status: "ACCEPTED",
      reasons: [],
    });
  });

  it("recoge todos los motivos de rechazo aplicables", () => {
    const resultado = filterJobOffer(
      crearOferta({
        jobFamily: "OTHER",
        role: "HARDWARE_TECHNICIAN",
        modality: "ONSITE",
        city: "Alicante",
        contract: "TEMPORARY",
        employmentType: "INTERNSHIP",
      }),
    );

    expect(resultado).toEqual({
      status: "REJECTED",
      reasons: [
        "INTERNSHIP",
        "TEMPORARY_CONTRACT",
        "IRRELEVANT_JOB_FAMILY",
        "HARDWARE_SUPPORT",
        "ONSITE_TOO_FAR",
      ],
    });
  });
});