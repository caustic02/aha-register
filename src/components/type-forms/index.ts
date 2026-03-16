import type React from 'react';
import type { ObjectType } from '../../db/types';
import MuseumObjectForm from './MuseumObjectForm';
import SiteForm from './SiteForm';
import IncidentForm from './IncidentForm';
import SpecimenForm from './SpecimenForm';
import ArchitecturalElementForm from './ArchitecturalElementForm';
import EnvironmentalSampleForm from './EnvironmentalSampleForm';
import ConservationRecordForm from './ConservationRecordForm';

export interface TypeFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (data: Record<string, any>) => void;
  t: (key: string) => string;
}

export const TYPE_FORM_MAP: Record<ObjectType, React.ComponentType<TypeFormProps>> = {
  museum_object: MuseumObjectForm,
  site: SiteForm,
  incident: IncidentForm,
  specimen: SpecimenForm,
  architectural_element: ArchitecturalElementForm,
  environmental_sample: EnvironmentalSampleForm,
  conservation_record: ConservationRecordForm,
};
