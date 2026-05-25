import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

interface PlanxoEmbedProps {
  calLink: string;           // e.g. "brandon/30min"
  className?: string;
  height?: number;
}

export default function PlanxoEmbed({ 
  calLink, 
  className = "", 
  height = 700 
}: PlanxoEmbedProps) {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        styles: { 
          branding: { brandColor: "#0f172a" } // Planxo dark slate
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  return (
    <div className={className}>
      <Cal 
        calLink={calLink} 
        style={{ 
          width: "100%", 
          height: `${height}px`, 
          overflow: "scroll" 
        }} 
      />
    </div>
  );
}