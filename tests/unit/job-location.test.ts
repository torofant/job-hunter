import { describe, expect, it } from "vitest";
import { getCityProvince } from "../../src/modules/jobs/job-location.js";

describe("getCityProvince", () => {
  it("devuelve CASTELLON para una ciudad de Castellón", () => {
    expect(getCityProvince("Castellón de la Plana")).toBe("CASTELLON");
    expect(getCityProvince("Vila-real")).toBe("CASTELLON");
    expect(getCityProvince("Burriana")).toBe("CASTELLON");
  });

  it("devuelve VALENCIA para una ciudad de Valencia", () => {
    expect(getCityProvince("Valencia")).toBe("VALENCIA");
    expect(getCityProvince("València")).toBe("VALENCIA");
    expect(getCityProvince("Sagunto")).toBe("VALENCIA");
  });

  it("devuelve OTHER para una ciudad conocida fuera de Castellón y Valencia", () => {
    expect(getCityProvince("Alicante")).toBe("OTHER");
    expect(getCityProvince("Madrid")).toBe("OTHER");
    expect(getCityProvince("Barcelona")).toBe("OTHER");
  });

  it("devuelve UNKNOWN para una ciudad desconocida", () => {
    expect(getCityProvince("Ciudad Inventada")).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN para null", () => {
    expect(getCityProvince(null)).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN para una ciudad vacía", () => {
    expect(getCityProvince("")).toBe("UNKNOWN");
    expect(getCityProvince("   ")).toBe("UNKNOWN");
  });

  it("normaliza acentos y mayus/minus", () => {
    expect(getCityProvince("CASTELLÓN DE LA PLANA")).toBe("CASTELLON");
    expect(getCityProvince("VALÈNCIA")).toBe("VALENCIA");
    expect(getCityProvince("MÁLAGA")).toBe("OTHER");
  });

  it("admite alias de ciudades conocidas", () => {
    expect(getCityProvince("Borriana")).toBe("CASTELLON");
    expect(getCityProvince("Burriana")).toBe("CASTELLON");
    expect(getCityProvince("Sagunt")).toBe("VALENCIA");
    expect(getCityProvince("Sagunto")).toBe("VALENCIA");
  });
});