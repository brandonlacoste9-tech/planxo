"use client";
import { useState } from "react";

interface Law25ConsentProps {
  onAccept: (data: { dataCollection: boolean; crossBorder: boolean }) => void;
}

export function Law25Consent({ onAccept }: Law25ConsentProps) {
  const [dataCollection, setDataCollection] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);

  return (
    <div className="p-4 border rounded-lg bg-gray-50 mt-4">
      <h3 className="font-bold text-base text-gray-900">Protection des renseignements personnels</h3>
      <p className="text-xs text-gray-500 mb-3">
        Conformément à la Loi 25 du Québec (Loi sur la protection des renseignements personnels),
        nous devons obtenir votre consentement explicite avant de collecter vos données.
      </p>
      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={dataCollection}
          onChange={() => setDataCollection(!dataCollection)}
          className="mt-0.5 accent-gray-900"
        />
        <span className="text-sm text-gray-700">
          J&apos;accepte la collecte de mes données personnelles nécessaires à la prise de rendez-vous.
        </span>
      </label>
      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={crossBorder}
          onChange={() => setCrossBorder(!crossBorder)}
          className="mt-0.5 accent-gray-900"
        />
        <span className="text-sm text-gray-700">
          Je comprends que mes données peuvent être traitées sur des serveurs situés hors du Québec.
        </span>
      </label>
      <button
        disabled={!dataCollection}
        onClick={() => onAccept({ dataCollection, crossBorder })}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Accepter et continuer
      </button>
    </div>
  );
}
